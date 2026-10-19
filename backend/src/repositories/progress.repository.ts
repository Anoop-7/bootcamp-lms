import { prisma } from "../config/db.js";
import { WatchProgress } from "@prisma/client";

export class ProgressRepository {
  async upsertProgress(params: {
    userId: string;
    contentId: string;
    watchedSeconds: number;
    isCompleted?: boolean;
    durationSec?: number;
  }): Promise<WatchProgress> {
    const existing = await prisma.watchProgress.findUnique({
      where: {
        userId_contentId: {
          userId: params.userId,
          contentId: params.contentId,
        },
      },
    });

    const currentMax = existing?.maxWatchedSeconds ?? 0;
    const newMaxWatchedSeconds = Math.max(currentMax, params.watchedSeconds);

    // Determine completion: once completed, remains completed
    const wasAlreadyCompleted = existing?.isCompleted ?? false;
    const meetsDurationThreshold =
      params.durationSec && params.durationSec > 0
        ? newMaxWatchedSeconds >= Math.floor(params.durationSec * 0.9)
        : false;

    const willBeCompleted =
      wasAlreadyCompleted || Boolean(params.isCompleted) || meetsDurationThreshold;

    const completedAt = wasAlreadyCompleted
      ? existing?.completedAt ?? new Date()
      : willBeCompleted
      ? new Date()
      : null;

    return prisma.watchProgress.upsert({
      where: {
        userId_contentId: {
          userId: params.userId,
          contentId: params.contentId,
        },
      },
      update: {
        watchedSeconds: params.watchedSeconds,
        maxWatchedSeconds: newMaxWatchedSeconds,
        isCompleted: willBeCompleted,
        completedAt,
      },
      create: {
        userId: params.userId,
        contentId: params.contentId,
        watchedSeconds: params.watchedSeconds,
        maxWatchedSeconds: params.watchedSeconds,
        isCompleted: willBeCompleted,
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