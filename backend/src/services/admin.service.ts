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

  async deleteUser(userId: string, currentAdminId: string): Promise<void> {
    if (userId === currentAdminId) {
      throw new Error("CANNOT_DELETE_SELF");
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        _count: {
          select: { cohortsTeaching: true },
        },
      },
    });

    if (!user) {
      throw new Error("USER_NOT_FOUND");
    }

    // Safety guard: Prevent deleting instructors with existing cohorts to avoid orphaned data
    if (user._count.cohortsTeaching > 0) {
      throw new Error("INSTRUCTOR_HAS_COHORTS");
    }

    // Atomic transaction cleaning up student-associated records
    await prisma.$transaction([
      prisma.watchProgress.deleteMany({ where: { userId } }),
      prisma.liveAttendance.deleteMany({ where: { userId } }),
      prisma.enrollment.deleteMany({ where: { userId } }),
      prisma.passwordReset.deleteMany({ where: { email: user.email } }),
      prisma.instructorInvite.deleteMany({ where: { email: user.email } }),
      prisma.user.delete({ where: { id: userId } }),
    ]);
  }
}