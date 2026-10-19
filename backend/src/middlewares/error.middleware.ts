import { Request, Response, NextFunction } from "express";
import { HttpError } from "../utils/httpError.js";
import { env } from "../config/env.js";

export const errorHandler = (
  err: any,
  _req: Request,
  res: Response,
  _next: NextFunction
): void => {
  // 1. Handled Domain HttpErrors
  if (err instanceof HttpError) {
    res.status(err.status).json({
      status: "error",
      message: err.message,
      ...(err.code && { code: err.code }),
    });
    return;
  }

  // 2. Prisma Database Errors
  if (err.code === "P2002") {
    res.status(409).json({
      status: "error",
      message: "A record with this unique value already exists.",
    });
    return;
  }
  if (err.code === "P2025") {
    res.status(404).json({
      status: "error",
      message: "The requested record was not found.",
    });
    return;
  }

  // 3. Unhandled Fallbacks
  console.error("💥 [UNCAUGHT SERVER EXCEPTION]:", err);

  const isProd = env.NODE_ENV === "production";
  res.status(500).json({
    status: "error",
    message: isProd ? "Internal Server Error" : (err.message || "An unexpected error occurred"),
  });
};