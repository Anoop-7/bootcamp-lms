import prisma from "../config/db.js";
import { CohortStatus, VideoStatus } from "@prisma/client";

export class CohortRepository {
  async findAllPublic() {
    return prisma.cohort.findMany({
      where: {
        status: {
          in: [
            CohortStatus.ONGOING_LIVE,
            CohortStatus.COMPLETED_LIVE,
            CohortStatus.SELF_PACED,
          ],
        },
      },
      orderBy: { createdAt: "desc" },
      include: {
        instructor: {
          select: {
            id: true,
            name: true,
            email: true,
            avatar: true,
          },
        },
      },
    });
  }

  async findById(id: string, forStudent: boolean = false) {
    return prisma.cohort.findUnique({
      where: { id },
      include: {
        instructor: {
          select: {
            id: true,
            name: true,
            email: true,
            avatar: true,
          },
        },
        folders: {
          orderBy: { order: "asc" },
          include: {
            contents: {
              where: forStudent
                ? {
                    OR: [
                      { type: { notIn: ["RECORDING", "OFFLINE_VIDEO"] } },
                      { videoAsset: { status: VideoStatus.READY } },
                    ],
                  }
                : undefined,
              orderBy: { order: "asc" },
              include: {
                videoAsset: {
                  select: {
                    id: true,
                    status: true,
                    posterKey: true,
                    durationSec: true,
                  },
                },
              },
            },
          },
        },
      },
    });
  }

  async findBySlug(slug: string, forStudent: boolean = false) {
    return prisma.cohort.findUnique({
      where: { slug },
      include: {
        instructor: {
          select: {
            id: true,
            name: true,
            email: true,
            avatar: true,
          },
        },
        folders: {
          orderBy: { order: "asc" },
          include: {
            contents: {
              where: forStudent
                ? {
                    OR: [
                      { type: { notIn: ["RECORDING", "OFFLINE_VIDEO"] } },
                      { videoAsset: { status: VideoStatus.READY } },
                    ],
                  }
                : undefined,
              orderBy: { order: "asc" },
              include: {
                videoAsset: {
                  select: {
                    id: true,
                    status: true,
                    posterKey: true,
                    durationSec: true,
                  },
                },
              },
            },
          },
        },
      },
    });
  }

  async updateLiveStatus(cohortId: string, isLiveActive: boolean, currentLiveUrl: string | null) {
    return prisma.cohort.update({
      where: { id: cohortId },
      data: {
        isLiveActive,
        currentLiveUrl,
      },
    });
  }

  async logLiveAttendance(userId: string, cohortId: string) {
    return prisma.liveAttendance.create({
      data: {
        userId,
        cohortId,
      },
    });
  }
}