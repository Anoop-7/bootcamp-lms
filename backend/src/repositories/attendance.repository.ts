import { prisma } from "../config/db.js";
import { LiveAttendance } from "@prisma/client";

export class AttendanceRepository {
  async recordAttendance(userId: string, cohortId: string): Promise<LiveAttendance> {
    return prisma.liveAttendance.create({
      data: {
        userId,
        cohortId,
      },
    });
  }

  async getCohortAttendance(cohortId: string) {
    return prisma.liveAttendance.findMany({
      where: { cohortId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            avatar: true,
          },
        },
      },
      orderBy: { joinedAt: "desc" },
    });
  }
}