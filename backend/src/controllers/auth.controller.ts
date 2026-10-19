import { Request, Response, NextFunction } from "express";
import { AuthService } from "../services/auth.service.js";
import { InviteService } from "../services/invite.service.js";
import { MailerService } from "../services/mailer.service.js";

const authService = new AuthService();
const inviteService = new InviteService();
const mailerService = new MailerService();

export class AuthController {
  async initiateRegister(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { email, password, name } = req.body;
      if (!email || !name || !password) {
        res.status(400).json({ status: "error", message: "Name, email, and password are required" });
        return;
      }
      if (password.length < 6) {
        res.status(400).json({ status: "error", message: "Password must be at least 6 characters" });
        return;
      }

      const existing = await authService.findByEmail(email);
      if (existing) {
        res.status(409).json({ status: "error", message: "Email is already registered" });
        return;
      }

      const otp = Math.floor(100000 + Math.random() * 900000).toString();
      await authService.storeRegistrationOtp(email, otp);

      const mailResult = await mailerService.sendOtp({ to: email, otp, type: "SIGNUP" });

      res.status(200).json({
        status: "success",
        message: mailResult.delivered
          ? "Verification code sent to your email."
          : "Verification code generated (development fallback active).",
        data: {
          email,
          ...(mailResult.devOtp && { devOtp: mailResult.devOtp }),
        },
      });
    } catch (err: any) {
      next(err);
    }
  }

  async completeRegister(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { email, otp, password, name } = req.body;
      if (!email || !otp || !password || !name) {
        res.status(400).json({ status: "error", message: "All registration fields and OTP are required" });
        return;
      }

      await authService.verifyRegistrationOtp(email, otp);
      const result = await authService.register({ email, password, name });

      res.status(201).json({ status: "success", data: result });
    } catch (err: any) {
      if (err.message === "INVALID_OTP") {
        res.status(400).json({ status: "error", message: "Invalid or expired verification code" });
        return;
      }
      if (err.message === "USER_ALREADY_EXISTS") {
        res.status(409).json({ status: "error", message: "Email is already registered" });
        return;
      }
      if (err.message === "PASSWORD_TOO_SHORT") {
        res.status(400).json({ status: "error", message: "Password must be at least 6 characters" });
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
      const authToken = authService.generateToken(user.id, user.role);

      res.status(200).json({
        status: "success",
        message: "Instructor onboarding completed successfully",
        data: {
          user,
          token: authToken,
        },
      });
    } catch (err: any) {
      next(err);
    }
  }
}