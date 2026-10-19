import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { Role } from "@prisma/client";
import { UserRepository } from "../repositories/user.repository.js";
import prisma from "../config/db.js";
import { env } from "../config/env.js";

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
    const record = await prisma.passwordReset.findUnique({
      where: { email: normalizedEmail },
    });

    if (!record) {
      throw new Error("INVALID_OTP");
    }

    if (new Date() > record.expiresAt) {
      await prisma.passwordReset.delete({ where: { email: normalizedEmail } });
      throw new Error("INVALID_OTP");
    }

    const isValid = await bcrypt.compare(otp.trim(), record.otpHash);
    if (!isValid) {
      await prisma.passwordReset.update({
        where: { email: normalizedEmail },
        data: { attempts: { increment: 1 } },
      });
      throw new Error("INVALID_OTP");
    }

    // Clean up OTP record upon successful verification
    await prisma.passwordReset.delete({ where: { email: normalizedEmail } });
  }

  async register(data: { email: string; password: string; name: string }) {
    const existingUser = await userRepository.findByEmail(data.email);
    if (existingUser) {
      throw new Error("USER_ALREADY_EXISTS");
    }

    if (!data.password || data.password.length < 6) {
      throw new Error("PASSWORD_TOO_SHORT");
    }

    const hashedPassword = await bcrypt.hash(data.password, 10);

    const newUser = await userRepository.create({
      email: data.email,
      password: hashedPassword,
      name: data.name,
      role: Role.STUDENT, // Strictly enforced: public register cannot assign elevated roles
    });

    const token = this.generateToken(newUser.id, newUser.role, (newUser as any).tokenVersion ?? 0);

    return {
      token,
      user: {
        id: newUser.id,
        email: newUser.email,
        name: newUser.name,
        role: newUser.role,
      },
    };
  }

  async login(email: string, password?: string) {
    const user = await userRepository.findByEmail(email);
    if (!user || !user.password) {
      throw new Error("INVALID_CREDENTIALS");
    }

    if (!password) {
      throw new Error("PASSWORD_REQUIRED");
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      throw new Error("INVALID_CREDENTIALS");
    }

    const token = this.generateToken(user.id, user.role, (user as any).tokenVersion ?? 0);
    return {
      token,
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
      throw new Error("USER_NOT_FOUND");
    }
    return user;
  }

  public generateToken(userId: string, role: Role, tokenVersion: number = 0): string {
    return jwt.sign({ userId, role, tokenVersion }, env.JWT_SECRET, { expiresIn: "24h" });
  }
}