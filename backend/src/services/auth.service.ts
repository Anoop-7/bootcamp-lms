import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { Role } from "@prisma/client";
import { UserRepository } from "../repositories/user.repository.js";
import prisma from "../config/db.js";
import { env } from "../config/env.js";
import { badRequest, conflict, tooManyRequests, unauthorized, notFound } from "../utils/httpError.js";

const userRepository = new UserRepository();

export class AuthService {
  async findByEmail(email: string) {
    const normalized = email.trim().toLowerCase();
    return await userRepository.findByEmail(normalized);
  }

  async storeRegistrationOtp(email: string, otp: string): Promise<void> {
    const normalizedEmail = email.trim().toLowerCase();
    const salt = await bcrypt.genSalt(10);
    const otpHash = await bcrypt.hash(otp, salt);
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
  }

  async verifyRegistrationOtp(email: string, otp: string): Promise<void> {
    const normalizedEmail = email.trim().toLowerCase();
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

    if (updateResult.count === 0) {
      const record = await prisma.passwordReset.findUnique({ where: { email: normalizedEmail } });
      if (!record) {
        throw badRequest("No OTP request found. Please request a new verification code.", "NO_OTP_REQUESTED");
      }
      if (now > record.expiresAt) {
        await prisma.passwordReset.delete({ where: { email: normalizedEmail } });
        throw badRequest("Verification code has expired. Please request a new one.", "OTP_EXPIRED");
      }
      if (record.attempts >= 5) {
        await prisma.passwordReset.delete({ where: { email: normalizedEmail } });
        throw tooManyRequests("Too many failed attempts. Please request a new code.", "MAX_ATTEMPTS_EXCEEDED");
      }
      throw badRequest("Invalid or expired verification code.", "INVALID_OTP");
    }

    // 2. Fetch updated record to verify hash
    const record = await prisma.passwordReset.findUnique({ where: { email: normalizedEmail } });
    if (!record) {
      throw badRequest("No OTP request found. Please request a new verification code.", "NO_OTP_REQUESTED");
    }

    const isValid = await bcrypt.compare(otp.trim(), record.otpHash);
    if (!isValid) {
      if (record.attempts >= 5) {
        await prisma.passwordReset.delete({ where: { email: normalizedEmail } });
        throw tooManyRequests("Too many failed attempts. Please request a new code.", "MAX_ATTEMPTS_EXCEEDED");
      }
      throw badRequest("Invalid verification code entered.", "INVALID_OTP");
    }

    // 3. Clean up OTP record upon successful verification
    await prisma.passwordReset.delete({ where: { email: normalizedEmail } });
  }

  async register(data: { email: string; password: string; name: string }) {
    const normalizedEmail = data.email.trim().toLowerCase();
    const existingUser = await userRepository.findByEmail(normalizedEmail);
    if (existingUser) {
      throw conflict("User with this email already exists", "USER_ALREADY_EXISTS");
    }

    if (!data.password || data.password.length < 8) {
      throw badRequest("Password must be at least 8 characters long", "PASSWORD_TOO_SHORT");
    }

    const hashedPassword = await bcrypt.hash(data.password, 10);

    const newUser = await userRepository.create({
      email: normalizedEmail,
      password: hashedPassword,
      name: data.name.trim(),
      role: Role.STUDENT,
    });

    const accessToken = this.generateAccessToken(newUser.id, newUser.role, newUser.tokenVersion ?? 0);
    const refreshToken = this.generateRefreshToken(newUser.id, newUser.tokenVersion ?? 0);

    return {
      token: accessToken,
      accessToken,
      refreshToken,
      user: {
        id: newUser.id,
        email: newUser.email,
        name: newUser.name,
        role: newUser.role,
      },
    };
  }

  async login(email: string, password?: string) {
    const normalizedEmail = email.trim().toLowerCase();
    const user = await userRepository.findByEmail(normalizedEmail);
    if (!user || !user.password) {
      throw unauthorized("Invalid email or password", "INVALID_CREDENTIALS");
    }

    if (!password) {
      throw badRequest("Password is required", "PASSWORD_REQUIRED");
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      throw unauthorized("Invalid email or password", "INVALID_CREDENTIALS");
    }

    const accessToken = this.generateAccessToken(user.id, user.role, user.tokenVersion ?? 0);
    const refreshToken = this.generateRefreshToken(user.id, user.tokenVersion ?? 0);

    return {
      token: accessToken,
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
    };
  }

  async refreshSession(refreshToken: string) {
    let decoded: { userId: string; tokenVersion?: number };
    try {
      decoded = jwt.verify(refreshToken, env.JWT_SECRET) as { userId: string; tokenVersion?: number };
    } catch {
      throw unauthorized("Invalid or expired refresh token", "INVALID_REFRESH_TOKEN");
    }

    if (!decoded.userId) {
      throw unauthorized("Malformed refresh token", "INVALID_REFRESH_TOKEN");
    }

    const user = await userRepository.findById(decoded.userId);
    if (!user) {
      throw unauthorized("User account no longer exists", "USER_NOT_FOUND");
    }

    if (decoded.tokenVersion !== undefined && decoded.tokenVersion !== user.tokenVersion) {
      throw unauthorized("Session expired or revoked. Please log in again.", "SESSION_REVOKED");
    }

    const newAccessToken = this.generateAccessToken(user.id, user.role, user.tokenVersion ?? 0);
    const newRefreshToken = this.generateRefreshToken(user.id, user.tokenVersion ?? 0);

    return {
      token: newAccessToken,
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
    };
  }

  async getCurrentUser(userId: string) {
    const user = await userRepository.findById(userId);
    if (!user) {
      throw notFound("User not found", "USER_NOT_FOUND");
    }
    return user;
  }

  public generateAccessToken(userId: string, role: Role, tokenVersion: number = 0): string {
    return jwt.sign({ userId, role, tokenVersion }, env.JWT_SECRET, { expiresIn: "15m" });
  }

  public generateRefreshToken(userId: string, tokenVersion: number = 0): string {
    return jwt.sign({ userId, tokenVersion, jti: crypto.randomUUID() }, env.JWT_SECRET, { expiresIn: "7d" });
  }

  public generateToken(userId: string, role: Role, tokenVersion: number = 0): string {
    return this.generateAccessToken(userId, role, tokenVersion);
  }
}