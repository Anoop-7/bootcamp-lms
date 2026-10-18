import { prisma } from "../config/db.js";
import { WatchProgress } from "@prisma/client";

export class ProgressRepository {
  async upsertProgress(params: {
    userId: string;
    contentId: string;
    watchedSeconds: number;
    isCompleted?: boolean;
  }): Promise<WatchProgress> {
    const isCompleted = params.isCompleted ?? false;
    const completedAt = isCompleted ? new Date() : null;

    return prisma.watchProgress.upsert({
      where: {
        userId_contentId: {
          userId: params.userId,
          contentId: params.contentId,
        },
      },
      update: {
        watchedSeconds: params.watchedSeconds,
        ...(params.isCompleted !== undefined && {
          isCompleted: params.isCompleted,
          completedAt: params.isCompleted ? new Date() : null,
        }),
      },
      create: {
        userId: params.userId,
        contentId: params.contentId,
        watchedSeconds: params.watchedSeconds,
        isCompleted,
        completedAt,
      },
    });
  }

  async getProgressByContent(userId: string, contentId: string): Promise<WatchProgress | null> {
    return prisma.watchProgress.findUnique({
      where: {
        userId_contentId: {
          userId,
          contentId,
        },
      },
    });
  }

  async getCohortProgressForUser(userId: string, cohortId: string) {
    return prisma.watchProgress.findMany({
      where: {
        userId,
        content: {
          folder: {
            cohortId,
          },
        },
      },
      include: {
        content: {
          select: {
            id: true,
            title: true,
            durationSec: true,
          },
        },
      },
    });
  }
}