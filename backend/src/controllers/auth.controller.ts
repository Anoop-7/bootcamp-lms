import { Request, Response, NextFunction } from "express";
import crypto from "crypto";
import { AuthService } from "../services/auth.service.js";
import { InviteService } from "../services/invite.service.js";
import { MailerService } from "../services/mailer.service.js";
import { env } from "../config/env.js";
import { badRequest, conflict } from "../utils/httpError.js";

const authService = new AuthService();
const inviteService = new InviteService();
const mailerService = new MailerService();

export class AuthController {
  async initiateRegister(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { email, password, name } = req.body;
      if (!email || !name || !password) {
        throw badRequest("Name, email, and password are required", "MISSING_REQUIRED_FIELDS");
      }
      if (password.length < 8) {
        throw badRequest("Password must be at least 8 characters", "PASSWORD_TOO_SHORT");
      }

      const existing = await authService.findByEmail(email);
      if (existing) {
        throw conflict("Email is already registered", "EMAIL_ALREADY_EXISTS");
      }

      // Cryptographically secure 6-digit OTP
      const otp = crypto.randomInt(100000, 1000000).toString();
      await authService.storeRegistrationOtp(email, otp);

      const mailResult = await mailerService.sendOtp({ to: email, otp, type: "SIGNUP" });

      const isDev = env.NODE_ENV === "development";

      res.status(200).json({
        status: "success",
        message: mailResult.delivered
          ? "Verification code sent to your email."
          : "Verification code generated.",
        data: {
          email,
          ...(isDev && mailResult.devOtp && { devOtp: mailResult.devOtp }),
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
        throw badRequest("All registration fields and OTP are required", "MISSING_FIELDS");
      }

      await authService.verifyRegistrationOtp(email, otp);
      const result = await authService.register({ email, password, name });

      res.status(201).json({ status: "success", data: result });
    } catch (err: any) {
      next(err);
    }
  }

  async login(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { email, password } = req.body;
      if (!email || !password) {
        throw badRequest("Email and password are required", "MISSING_CREDENTIALS");
      }

      const result = await authService.login(email, password);
      res.status(200).json({ status: "success", data: result });
    } catch (err: any) {
      next(err);
    }
  }

  async me(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const user = await authService.getCurrentUser(userId);
      res.status(200).json({ status: "success", data: user });
    } catch (err: any) {
      next(err);
    }
  }

  async verifyInvite(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { token } = req.params;
      if (!token) {
        throw badRequest("Invite token is required", "MISSING_INVITE_TOKEN");
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
        throw badRequest("Invite token is required", "MISSING_INVITE_TOKEN");
      }

      const user = await inviteService.acceptInvite(token, name, password);
      // Issue token with the created user's actual tokenVersion
      const authToken = authService.generateToken(user.id, user.role, (user as any).tokenVersion ?? 0);

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