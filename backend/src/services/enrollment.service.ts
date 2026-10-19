import { EnrollmentRepository } from "../repositories/enrollment.repository.js";
import { CohortRepository } from "../repositories/cohort.repository.js";
import { notFound, conflict, paymentRequired } from "../utils/httpError.js";
import { env } from "../config/env.js";

const enrollmentRepo = new EnrollmentRepository();
const cohortRepo = new CohortRepository();

export class EnrollmentService {
  async enrollStudent(userId: string, cohortId: string) {
    // 1. Check if cohort exists
    const cohort = await cohortRepo.findById(cohortId);
    if (!cohort) {
      throw notFound("Cohort not found", "COHORT_NOT_FOUND");
    }

    // 2. Prevent duplicate enrollments
    const existing = await enrollmentRepo.findEnrollment(userId, cohortId);
    if (existing) {
      throw conflict("You are already enrolled in this cohort", "ALREADY_ENROLLED");
    }

    // 3. Paid Cohort Verification Guard (C4)
    if (cohort.price > 0) {
      // In development, mock payments are permitted only when PAYMENTS_MODE is explicitly 'mock'
      const isDevMock = env.NODE_ENV !== "production" && env.PAYMENTS_MODE === "mock";
      
      if (!isDevMock) {
        throw paymentRequired(
          "Payment required to enroll in this cohort. Direct enrollment for paid cohorts is disabled.",
          "PAYMENT_REQUIRED"
        );
      }
    }

    // 4. Atomically record enrollment (and zero-amount or mock order)
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