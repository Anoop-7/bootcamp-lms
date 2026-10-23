import crypto from "crypto";
import bcrypt from "bcryptjs";
import prisma from "../config/db.js";
import { badRequest, notFound, tooManyRequests } from "../utils/httpError.js";

export class PasswordResetService {
  async generateAndSaveResetOtp(email: string): Promise<string | null> {
    const normalizedEmail = email.trim().toLowerCase();
    const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });

    // Silent return to prevent account enumeration
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

  async verifyOtpAndReset(email: string, otp: string, newPassword: string): Promise<void> {
    const normalizedEmail = email.trim().toLowerCase();

    if (!newPassword || newPassword.length < 8) {
      throw badRequest("New password must be at least 8 characters", "PASSWORD_TOO_SHORT");
    }

    const now = new Date();

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

    // Success: Hash new password, invalidate active tokens via tokenVersion increment, and delete OTP
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(newPassword, salt);

    await prisma.$transaction([
      prisma.user.update({
        where: { email: normalizedEmail },
        data: {
          password: passwordHash,
          tokenVersion: { increment: 1 }, // Invalidates all prior JWTs
        },
      }),
      prisma.passwordReset.delete({
        where: { email: normalizedEmail },
      }),
    ]);
  }

  async updateCurrentPassword(userId: string, currentPassword: string, newPassword: string): Promise<void> {
    if (!newPassword || newPassword.length < 8) {
      throw badRequest("New password must be at least 8 characters", "PASSWORD_TOO_SHORT");
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
      data: {
        password: passwordHash,
        tokenVersion: { increment: 1 }, // Invalidates prior sessions
      },
    });
  }
}