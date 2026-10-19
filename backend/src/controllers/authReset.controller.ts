import { Request, Response, NextFunction } from "express";
import { PasswordResetService } from "../services/passwordReset.service.js";
import { MailerService } from "../services/mailer.service.js";
import { env } from "../config/env.js";

const resetService = new PasswordResetService();
const mailerService = new MailerService();

export class AuthResetController {
  async forgotPassword(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { email } = req.body;
      if (!email || !email.includes("@")) {
        res.status(400).json({ status: "error", message: "Valid email is required" });
        return;
      }

      const rawOtp = await resetService.generateAndSaveResetOtp(email);
      let devOtp: string | undefined = undefined;

      // Only attempt email dispatch if user was found
      if (rawOtp) {
        try {
          const mailResult = await mailerService.sendOtp({
            to: email,
            otp: rawOtp,
            type: "PASSWORD_RESET",
          });
          if (env.NODE_ENV === "development" && mailResult.devOtp) {
            devOtp = mailResult.devOtp;
          }
        } catch (mailErr: any) {
          console.warn("[MAILER ERROR] Failed to deliver password reset email:", mailErr.message);
        }
      }

      // Consistent 200 response regardless of user existence (prevents email enumeration)
      res.status(200).json({
        status: "success",
        message: "If an account exists with that email, a verification code has been dispatched.",
        data: {
          email,
          ...(devOtp && { devOtp }),
        },
      });
    } catch (err: any) {
      next(err);
    }
  }

  async resetPassword(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { email, otp, newPassword } = req.body;
      if (!email || !otp || !newPassword) {
        res.status(400).json({ status: "error", message: "Email, OTP, and new password are required" });
        return;
      }

      await resetService.verifyOtpAndReset(email, otp, newPassword);
      res.status(200).json({ status: "success", message: "Password reset successfully. You can now login." });
    } catch (err: any) {
      next(err);
    }
  }

  async changePasswordProfile(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const { currentPassword, newPassword } = req.body;

      if (!currentPassword || !newPassword) {
        res.status(400).json({ status: "error", message: "Both current and new passwords are required" });
        return;
      }

      await resetService.updateCurrentPassword(userId, currentPassword, newPassword);
      res.status(200).json({ status: "success", message: "Password updated successfully" });
    } catch (err: any) {
      next(err);
    }
  }
}