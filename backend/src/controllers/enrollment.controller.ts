import { Request, Response, NextFunction } from "express";
import { EnrollmentService } from "../services/enrollment.service.js";

const enrollmentService = new EnrollmentService();

export class EnrollmentController {
  async enrollInCohort(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const { cohortId } = req.params as { cohortId: string };

      const result = await enrollmentService.enrollStudent(userId, cohortId);

      res.status(201).json({
        status: "success",
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  async getMyEnrollments(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const enrollments = await enrollmentService.getMyEnrollments(userId);

      res.status(200).json({
        status: "success",
        data: enrollments,
      });
    } catch (error) {
      next(error);
    }
  }
}