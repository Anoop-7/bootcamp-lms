import { ProgressRepository } from "../repositories/progress.repository.js";
import { ContentRepository } from "../repositories/content.repository.js";
import { EnrollmentRepository } from "../repositories/enrollment.repository.js";

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
    const content = await contentRepo.findContentById(params.contentId);
    if (!content) {
      const error: any = new Error("Content not found");
      error.statusCode = 404;
      throw error;
    }

    // Verify enrollment via parent folder -> cohort
    const enrollment = await enrollmentRepo.findEnrollment(
      params.userId,
      content.folder.cohortId
    );
    if (!enrollment) {
      const error: any = new Error("You must be enrolled to track progress");
      error.statusCode = 403;
      throw error;
    }

    return progressRepo.upsertProgress(params);
  }

  async getContentProgress(userId: string, contentId: string) {
    return progressRepo.getProgressByContent(userId, contentId);
  }

  async getCohortProgress(userId: string, cohortId: string) {
    return progressRepo.getCohortProgressForUser(userId, cohortId);
  }
}