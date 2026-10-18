import prisma from "../config/db.js";
import { User, Role } from "@prisma/client";

export class UserRepository {
  async findByEmail(email: string): Promise<User | null> {
    return prisma.user.findUnique({
      where: { email },
    });
  }

  async findById(id: string): Promise<Omit<User, "password"> | null> {
    return prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        avatar: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async create(data: {
    email: string;
    password?: string;
    name: string;
    role?: Role;
  }): Promise<User> {
    return prisma.user.create({
      data,
    });
  }
}