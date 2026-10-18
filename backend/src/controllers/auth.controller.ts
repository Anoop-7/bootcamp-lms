import { Request, Response, NextFunction } from "express";
import { AuthService } from "../services/auth.service.js";
import { InviteService } from "../services/invite.service.js";
import jwt from "jsonwebtoken";


const authService = new AuthService();
const inviteService = new InviteService();

export class AuthController {
  async register(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { email, password, name, role } = req.body;
      if (!email || !name) {
        res.status(400).json({ status: "error", message: "Email and name are required" });
        return;
      }

      const result = await authService.register({ email, password, name, role });
      res.status(201).json({ status: "success", data: result });
    } catch (err: any) {
      if (err.message === "USER_ALREADY_EXISTS") {
        res.status(409).json({ status: "error", message: "Email is already registered" });
        return;
      }
      next(err);
    }
  }

  async login(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { email, password } = req.body;
      if (!email || !password) {
        res.status(400).json({ status: "error", message: "Email and password are required" });
        return;
      }

      const result = await authService.login(email, password);
      res.status(200).json({ status: "success", data: result });
    } catch (err: any) {
      if (err.message === "INVALID_CREDENTIALS") {
        res.status(401).json({ status: "error", message: "Invalid email or password" });
        return;
      }
      next(err);
    }
  }

  async me(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const user = await authService.getCurrentUser(userId);
      res.status(200).json({ status: "success", data: user });
    } catch (err: any) {
      if (err.message === "USER_NOT_FOUND") {
        res.status(404).json({ status: "error", message: "User not found" });
        return;
      }
      next(err);
    }
  }

  async verifyInvite(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { token } = req.params;
      if (!token) {
        res.status(400).json({ status: "error", message: "Invite token is required" });
        return;
      }

      const details = await inviteService.verifyInviteToken(token as string);
      res.status(200).json({ status: "success", data: details });
    } catch (err: any) {
      if (err.message === "INVITE_NOT_FOUND") {
        res.status(404).json({ status: "error", message: "Invalid invite token." });
        return;
      }
      if (err.message === "INVITE_ALREADY_USED_OR_REVOKED") {
        res.status(400).json({ status: "error", message: "This invite has already been redeemed or revoked." });
        return;
      }
      if (err.message === "INVITE_EXPIRED") {
        res.status(410).json({ status: "error", message: "This invite has expired. Please contact the administrator for a new link." });
        return;
      }
      next(err);
    }
  }

  async registerInvitedInstructor(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { token, name, password } = req.body;
      if (!token) {
        res.status(400).json({ status: "error", message: "Invite token is required" });
        return;
      }

      const user = await inviteService.acceptInvite(token, name, password);

      const jwtSecret = process.env.JWT_SECRET || "default_jwt_secret_change_in_prod";
      const authToken = jwt.sign(
        { userId: user.id, role: user.role },
        jwtSecret,
        { expiresIn: "7d" }
      );

      res.status(200).json({
        status: "success",
        message: "Instructor onboarding completed successfully",
        data: {
          user,
          token: authToken,
        },
      });
    } catch (err: any) {
      if (err.message === "INVALID_CREDENTIALS") {
        res.status(401).json({ status: "error", message: "Incorrect password for this existing account." });
        return;
      }
      if (err.message === "PASSWORD_TOO_SHORT") {
        res.status(400).json({ status: "error", message: "Password must be at least 6 characters." });
        return;
      }
      next(err);
    }
  }
}