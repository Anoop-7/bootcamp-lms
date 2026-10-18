import { Request, Response, NextFunction } from "express";
import { PasswordResetService } from "../services/passwordReset.service.js";

const resetService = new PasswordResetService();

export class AuthResetController {
  async forgotPassword(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { email } = req.body;
      if (!email || !email.includes("@")) {
        res.status(400).json({ status: "error", message: "Valid email is required" });
        return;
      }
      const data = await resetService.requestOtp(email);
      res.status(200).json({ status: "success", data });
    } catch (err: any) {
      if (err.message === "USER_NOT_FOUND") {
        res.status(404).json({ status: "error", message: "No account found with this email" });
        return;
      }
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
      if (err.message === "NO_OTP_REQUESTED") {
        res.status(400).json({ status: "error", message: "No OTP request found. Please request a new one." });
        return;
      }
      if (err.message === "OTP_EXPIRED") {
        res.status(400).json({ status: "error", message: "OTP has expired. Please request a new code." });
        return;
      }
      if (err.message === "INVALID_OTP") {
        res.status(400).json({ status: "error", message: "Invalid OTP code entered." });
        return;
      }
      if (err.message === "MAX_ATTEMPTS_EXCEEDED") {
        res.status(429).json({ status: "error", message: "Too many failed attempts. Please request a new OTP." });
        return;
      }
      if (err.message === "PASSWORD_TOO_SHORT") {
        res.status(400).json({ status: "error", message: "New password must be at least 6 characters" });
        return;
      }
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
      if (err.message === "INCORRECT_CURRENT_PASSWORD") {
        res.status(400).json({ status: "error", message: "Current password is incorrect" });
        return;
      }
      if (err.message === "PASSWORD_TOO_SHORT") {
        res.status(400).json({ status: "error", message: "Password must be at least 6 characters" });
        return;
      }
      next(err);
    }
  }
}