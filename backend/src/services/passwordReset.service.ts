import crypto from "crypto";
import bcrypt from "bcryptjs";
import prisma from "../config/db.js";
import { badRequest, notFound, tooManyRequests } from "../utils/httpError.js";

export class PasswordResetService {
  /**
   * Generates and stores a hashed 6-digit OTP.
   * Returns the raw OTP string if the user exists, or null if no user is found.
   */
  async generateAndSaveResetOtp(email: string): Promise<string | null> {
    const normalizedEmail = email.trim().toLowerCase();
    const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });

    // Silent return to prevent user enumeration
    if (!user) {
      return null;
    }

    // crypto.randomInt max is exclusive: [100000, 1000000) generates 100000 through 999999
    const rawOtp = crypto.randomInt(100000, 1000000).toString();
    const salt = await bcrypt.genSalt(10);
    const otpHash = await bcrypt.hash(rawOtp, salt);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    await prisma.passwordReset.upsert({
      where: { email: normalizedEmail },
      create: {
        email: normalizedEmail,
        otpHash,
        expiresAt,
        attempts: 0,
      },
      update: {
        otpHash,
        expiresAt,
        attempts: 0,
      },
    });

    return rawOtp;
  }

  /**
   * Atomically verifies the OTP with race-condition prevention and max-attempt enforcement.
   */
  async verifyOtpAndReset(email: string, otp: string, newPassword: string): Promise<void> {
    const normalizedEmail = email.trim().toLowerCase();

    if (!newPassword || newPassword.length < 6) {
      throw badRequest("New password must be at least 6 characters", "PASSWORD_TOO_SHORT");
    }

    const now = new Date();

    // 1. Atomic attempt increment: only increment if attempts < 5 and not expired
    const updateResult = await prisma.passwordReset.updateMany({
      where: {
        email: normalizedEmail,
        attempts: { lt: 5 },
        expiresAt: { gt: now },
      },
      data: {
        attempts: { increment: 1 },
      },
    });

    // If no row was updated, the record either never existed, expired, or exceeded 5 attempts
    if (updateResult.count === 0) {
      const record = await prisma.passwordReset.findUnique({ where: { email: normalizedEmail } });
      if (!record) {
        throw badRequest("No OTP request found. Please request a new code.", "NO_OTP_REQUESTED");
      }
      if (now > record.expiresAt) {
        await prisma.passwordReset.delete({ where: { email: normalizedEmail } });
        throw badRequest("OTP has expired. Please request a new code.", "OTP_EXPIRED");
      }
      if (record.attempts >= 5) {
        await prisma.passwordReset.delete({ where: { email: normalizedEmail } });
        throw tooManyRequests("Too many failed attempts. Please request a new OTP.", "MAX_ATTEMPTS_EXCEEDED");
      }
      throw badRequest("Invalid or expired OTP code.", "INVALID_OTP");
    }

    // 2. Fetch the updated record to compare hash
    const resetRecord = await prisma.passwordReset.findUnique({
      where: { email: normalizedEmail },
    });

    if (!resetRecord) {
      throw badRequest("No OTP request found. Please request a new code.", "NO_OTP_REQUESTED");
    }

    const isValid = await bcrypt.compare(otp.trim(), resetRecord.otpHash);
    if (!isValid) {
      if (resetRecord.attempts >= 5) {
        await prisma.passwordReset.delete({ where: { email: normalizedEmail } });
        throw tooManyRequests("Too many failed attempts. Please request a new OTP.", "MAX_ATTEMPTS_EXCEEDED");
      }
      throw badRequest("Invalid OTP code entered.", "INVALID_OTP");
    }

    // 3. Success: Hash new password, update user, and remove OTP record
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(newPassword, salt);

    await prisma.$transaction([
      prisma.user.update({
        where: { email: normalizedEmail },
        data: { password: passwordHash },
      }),
      prisma.passwordReset.delete({
        where: { email: normalizedEmail },
      }),
    ]);
  }

  async updateCurrentPassword(userId: string, currentPassword: string, newPassword: string): Promise<void> {
    if (!newPassword || newPassword.length < 6) {
      throw badRequest("New password must be at least 6 characters", "PASSWORD_TOO_SHORT");
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.password) {
      throw notFound("User not found", "USER_NOT_FOUND");
    }

    const matches = await bcrypt.compare(currentPassword, user.password);
    if (!matches) {
      throw badRequest("Current password is incorrect", "INCORRECT_CURRENT_PASSWORD");
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(newPassword, salt);

    await prisma.user.update({
      where: { id: userId },
      data: { password: passwordHash },
    });
  }
}