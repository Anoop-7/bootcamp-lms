import { AttendanceRepository } from "../repositories/attendance.repository.js";
import { CohortRepository } from "../repositories/cohort.repository.js";
import { EnrollmentRepository } from "../repositories/enrollment.repository.js";

const attendanceRepo = new AttendanceRepository();
const cohortRepo = new CohortRepository();
const enrollmentRepo = new EnrollmentRepository();

export class AttendanceService {
  async joinLiveSession(userId: string, cohortId: string): Promise<string> {
    const cohort = await cohortRepo.findById(cohortId);
    if (!cohort) {
      const error: any = new Error("Cohort not found");
      error.statusCode = 404;
      throw error;
    }

    if (!cohort.isLiveActive || !cohort.currentLiveUrl) {
      const error: any = new Error("No active live session for this cohort");
      error.statusCode = 400;
      throw error;
    }

    // Verify student is enrolled
    const enrollment = await enrollmentRepo.findEnrollment(userId, cohortId);
    if (!enrollment) {
      const error: any = new Error("You are not enrolled in this cohort");
      error.statusCode = 403;
      throw error;
    }

    // Audit attendance entry
    await attendanceRepo.recordAttendance(userId, cohortId);

    return cohort.currentLiveUrl;
  }

  async getAttendanceList(cohortId: string, instructorId: string, role: string) {
    const cohort = await cohortRepo.findById(cohortId);
    if (!cohort) {
      const error: any = new Error("Cohort not found");
      error.statusCode = 404;
      throw error;
    }

    // Ensure instructor owns this cohort or is an ADMIN
    if (role !== "ADMIN" && cohort.instructorId !== instructorId) {
      const error: any = new Error("Unauthorized to view attendance for this cohort");
      error.statusCode = 403;
      throw error;
    }

    return attendanceRepo.getCohortAttendance(cohortId);
  }
}