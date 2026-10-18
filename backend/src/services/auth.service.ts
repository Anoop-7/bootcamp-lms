import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { Role } from "@prisma/client";
import { UserRepository } from "../repositories/user.repository.js";

const userRepository = new UserRepository();

export class AuthService {
  async register(data: { email: string; password?: string; name: string; role?: Role }) {
    const existingUser = await userRepository.findByEmail(data.email);
    if (existingUser) {
      throw new Error("USER_ALREADY_EXISTS");
    }

    let hashedPassword: string | undefined = undefined;
    if (data.password) {
      hashedPassword = await bcrypt.hash(data.password, 10);
    }

    const newUser = await userRepository.create({
      email: data.email,
      password: hashedPassword,
      name: data.name,
      role: data.role || Role.STUDENT,
    });

    const token = this.generateToken(newUser.id, newUser.role);

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

    const token = this.generateToken(user.id, user.role);

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

  private generateToken(userId: string, role: Role): string {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
      throw new Error("JWT_SECRET_NOT_SET");
    }
    return jwt.sign({ userId, role }, secret, { expiresIn: "24h" });
  }
}