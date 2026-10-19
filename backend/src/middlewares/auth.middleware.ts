import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { Role } from "@prisma/client";
import prisma from "../config/db.js";
import { env } from "../config/env.js";

export interface AuthUserPayload {
  userId: string;
  role: Role;
  tokenVersion?: number;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUserPayload;
    }
  }
}

export const authenticate = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res.status(401).json({ status: "error", message: "Authorization token missing or malformed" });
    return;
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(token, env.JWT_SECRET) as AuthUserPayload;

    // Database check: verify active user state and tokenVersion
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: { id: true, role: true, tokenVersion: true },
    });

    if (!user) {
      res.status(401).json({ status: "error", message: "User account no longer exists" });
      return;
    }

    if (decoded.tokenVersion !== undefined && decoded.tokenVersion !== user.tokenVersion) {
      res.status(401).json({ status: "error", message: "Session expired or revoked. Please login again." });
      return;
    }

    req.user = {
      userId: user.id,
      role: user.role,
      tokenVersion: user.tokenVersion,
    };

    next();
  } catch {
    res.status(401).json({ status: "error", message: "Invalid or expired token" });
  }
};

export const authorize = (...allowedRoles: Role[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ status: "error", message: "Unauthenticated" });
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      res.status(403).json({ status: "error", message: "Forbidden: insufficient permissions" });
      return;
    }

    next();
  };
};

export const optionalAuthenticate = async (
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return next();
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(token, env.JWT_SECRET) as AuthUserPayload;
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: { id: true, role: true, tokenVersion: true },
    });

    if (user && (decoded.tokenVersion === undefined || decoded.tokenVersion === user.tokenVersion)) {
      req.user = {
        userId: user.id,
        role: user.role,
        tokenVersion: user.tokenVersion,
      };
    }
  } catch {
    // Continue as guest if token is invalid or expired
  }
  next();
};