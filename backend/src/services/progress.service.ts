import { ProgressRepository } from "../repositories/progress.repository.js";
import { ContentRepository } from "../repositories/content.repository.js";
import { EnrollmentRepository } from "../repositories/enrollment.repository.js";
import { notFound, forbidden, badRequest } from "../utils/httpError.js";

const progressRepo = new ProgressRepository();
const contentRepo = new ContentRepository();
const enrollmentRepo = new EnrollmentRepository();

export class ProgressService {
  async updateProgress(params: {
    userId: string;
    contentId: string;
    watchedSeconds: number;
    isCompleted?: boolean;
  }) {
    // 1. Validate watchedSeconds number format and bounds
    if (
      typeof params.watchedSeconds !== "number" ||
      !Number.isFinite(params.watchedSeconds) ||
      params.watchedSeconds < 0
    ) {
      throw badRequest("Field 'watchedSeconds' must be a non-negative finite number", "INVALID_WATCHED_SECONDS");
    }

    const content = await contentRepo.findContentById(params.contentId);
    if (!content) {
      throw notFound("Content lecture not found", "CONTENT_NOT_FOUND");
    }

    // 2. Verify active enrollment via parent folder -> cohort
    const enrollment = await enrollmentRepo.findEnrollment(
      params.userId,
      content.folder.cohortId
    );
    if (!enrollment) {
      throw forbidden("You must be enrolled in this cohort to track learning progress", "FORBIDDEN_NOT_ENROLLED");
    }

    // 3. Upper bound sanity check: progress cannot exceed lecture duration + 30s buffer
    const duration = content.durationSec || 0;
    const clampedWatchedSeconds =
      duration > 0 ? Math.min(params.watchedSeconds, duration + 30) : params.watchedSeconds;

    return progressRepo.upsertProgress({
      userId: params.userId,
      contentId: params.contentId,
      watchedSeconds: Math.floor(clampedWatchedSeconds),
      isCompleted: params.isCompleted,
      durationSec: duration,
    });
  }

  async getContentProgress(userId: string, contentId: string) {
    return progressRepo.getProgressByContent(userId, contentId);
  }

  async getCohortProgress(userId: string, cohortId: string) {
    return progressRepo.getCohortProgressForUser(userId, cohortId);
  }
}