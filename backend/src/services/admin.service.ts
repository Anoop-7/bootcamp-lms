import prisma from "../config/db.js";
import { CohortStatus, Role } from "@prisma/client";

export class AdminService {
  async listAllCohorts() {
    return prisma.cohort.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        instructor: {
          select: { id: true, name: true, email: true },
        },
        _count: {
          select: {
            enrollments: true,
            folders: true,
            orders: true,
          },
        },
      },
    });
  }

  async updateCohortStatus(cohortId: string, status: CohortStatus, isLiveActive?: boolean) {
    return prisma.cohort.update({
      where: { id: cohortId },
      data: {
        status,
        ...(isLiveActive !== undefined ? { isLiveActive } : {}),
      },
    });
  }

  async getCohortEnrollments(cohortId: string) {
    return prisma.enrollment.findMany({
      where: { cohortId },
      orderBy: { enrolledAt: "desc" },
      include: {
        user: {
          select: { id: true, name: true, email: true, createdAt: true },
        },
      },
    });
  }

  async manualEnrollStudent(cohortId: string, email: string) {
    const user = await prisma.user.findUnique({
      where: { email: email.trim().toLowerCase() },
    });

    if (!user) {
      throw new Error("USER_NOT_FOUND");
    }

    const existing = await prisma.enrollment.findUnique({
      where: {
        userId_cohortId: {
          userId: user.id,
          cohortId,
        },
      },
    });

    if (existing) {
      throw new Error("ALREADY_ENROLLED");
    }

    return prisma.enrollment.create({
      data: {
        userId: user.id,
        cohortId,
      },
      include: {
        user: {
          select: { id: true, name: true, email: true },
        },
      },
    });
  }

  async revokeEnrollment(cohortId: string, userId: string) {
    return prisma.enrollment.delete({
      where: {
        userId_cohortId: {
          userId,
          cohortId,
        },
      },
    });
  }
}