import prisma from "../config/db.js";
import { CohortStatus, VideoStatus, ContentType, Prisma } from "@prisma/client";

// Public instructor projection (scrubs email to prevent scraping/phishing)
const PUBLIC_INSTRUCTOR_SELECT = {
  id: true,
  name: true,
  avatar: true,
} satisfies Prisma.UserSelect;

const getCohortInclude = (forStudent: boolean): Prisma.CohortInclude => ({
  instructor: {
    select: PUBLIC_INSTRUCTOR_SELECT,
  },
  folders: {
    orderBy: { order: "asc" },
    include: {
      contents: {
        where: forStudent
          ? {
              OR: [
                {
                  type: {
                    notIn: [ContentType.RECORDING, ContentType.OFFLINE_VIDEO],
                  },
                },
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
});

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
          select: PUBLIC_INSTRUCTOR_SELECT,
        },
      },
    });
  }

  async findById(id: string, forStudent: boolean = false) {
    return prisma.cohort.findUnique({
      where: { id },
      include: getCohortInclude(forStudent),
    });
  }

  async findBySlug(slug: string, forStudent: boolean = false) {
    return prisma.cohort.findUnique({
      where: { slug },
      include: getCohortInclude(forStudent),
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