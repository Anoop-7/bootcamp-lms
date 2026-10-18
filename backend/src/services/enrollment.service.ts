import { EnrollmentRepository } from "../repositories/enrollment.repository.js";
import { CohortRepository } from "../repositories/cohort.repository.js";

const enrollmentRepo = new EnrollmentRepository();
const cohortRepo = new CohortRepository();

export class EnrollmentService {
  async enrollStudent(userId: string, cohortId: string) {
    // 1. Check if cohort exists
    const cohort = await cohortRepo.findById(cohortId);
    if (!cohort) {
      const error: any = new Error("Cohort not found");
      error.statusCode = 404;
      throw error;
    }

    // 2. Prevent duplicate enrollments
    const existing = await enrollmentRepo.findEnrollment(userId, cohortId);
    if (existing) {
      const error: any = new Error("User is already enrolled in this cohort");
      error.statusCode = 409;
      throw error;
    }

    // 3. Atomically record purchase and enrollment
    return enrollmentRepo.createEnrollmentWithOrder({
      userId,
      cohortId,
      amount: cohort.price,
    });
  }

  async getMyEnrollments(userId: string) {
    return enrollmentRepo.getStudentEnrollments(userId);
  }
}