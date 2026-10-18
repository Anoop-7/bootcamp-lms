import crypto from "crypto";
import bcrypt from "bcryptjs";
import prisma from "../config/db.js";

export class PasswordResetService {
  async requestOtp(email: string): Promise<{ message: string; previewOtp?: string }> {
    const normalizedEmail = email.trim().toLowerCase();
    const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });

    if (!user) {
      throw new Error("USER_NOT_FOUND");
    }

    // Generate cryptographically secure 6-digit OTP
    const rawOtp = crypto.randomInt(100000, 999999).toString();
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

    console.log(`🔑 [DUMMY OTP DISPATCH]: ${normalizedEmail} -> ${rawOtp}`);

    return {
      message: `OTP sent to registered number and email - ${rawOtp}`,
      previewOtp: rawOtp,
    };
  }

  async verifyOtpAndReset(email: string, otp: string, newPassword: string): Promise<void> {
    const normalizedEmail = email.trim().toLowerCase();

    if (!newPassword || newPassword.length < 6) {
      throw new Error("PASSWORD_TOO_SHORT");
    }

    const resetRecord = await prisma.passwordReset.findUnique({
      where: { email: normalizedEmail },
    });

    if (!resetRecord) {
      throw new Error("NO_OTP_REQUESTED");
    }

    if (new Date() > resetRecord.expiresAt) {
      await prisma.passwordReset.delete({ where: { email: normalizedEmail } });
      throw new Error("OTP_EXPIRED");
    }

    if (resetRecord.attempts >= 5) {
      await prisma.passwordReset.delete({ where: { email: normalizedEmail } });
      throw new Error("MAX_ATTEMPTS_EXCEEDED");
    }

    const isValid = await bcrypt.compare(otp.trim(), resetRecord.otpHash);
    if (!isValid) {
      await prisma.passwordReset.update({
        where: { email: normalizedEmail },
        data: { attempts: { increment: 1 } },
      });
      throw new Error("INVALID_OTP");
    }

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
      throw new Error("PASSWORD_TOO_SHORT");
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.password) {
      throw new Error("USER_NOT_FOUND");
    }

    const matches = await bcrypt.compare(currentPassword, user.password);
    if (!matches) {
      throw new Error("INCORRECT_CURRENT_PASSWORD");
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(newPassword, salt);

    await prisma.user.update({
      where: { id: userId },
      data: { password: passwordHash },
    });
  }
}