import { Request, Response, NextFunction } from "express";
import { CohortService } from "../services/cohort.service.js";
import prisma from "../config/db.js";

const cohortService = new CohortService();

export class CohortController {
  async getCohorts(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const cohorts = await cohortService.getPublicCohorts();
      res.status(200).json({ status: "success", data: cohorts });
    } catch (err: any) {
      next(err);
    }
  }

  async getInstructorCohorts(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const instructorId = req.user!.userId;
      const role = req.user!.role;

      const cohorts = await prisma.cohort.findMany({
        where: role === "ADMIN" ? {} : { instructorId },
        orderBy: { createdAt: "desc" },
      });

      res.status(200).json({ status: "success", data: cohorts });
    } catch (err: any) {
      next(err);
    }
  }

  async getCohortBySlug(req: Request, res: Response): Promise<void> {
    try {
      const slug = req.params.slug as string;
      const userId = req.user?.userId;
      const userRole = req.user?.role;

      const cohort = await cohortService.getCohortDetails(slug, userId, userRole);
      res.status(200).json({ status: "success", data: cohort });
    } catch (err: any) {
      if (err.message === "COHORT_NOT_FOUND") {
        res.status(404).json({ status: "error", message: "Cohort not found" });
        return;
      }
      res.status(500).json({ status: "error", message: err.message });
    }
  }

  async createCohort(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const instructorId = req.user!.userId;
      const cohort = await cohortService.createCohort({ ...req.body, instructorId });
      res.status(201).json({ status: "success", data: cohort });
    } catch (err: any) {
      if (err.message === "DUPLICATE_TITLE_SAME_INSTRUCTOR") {
        res.status(400).json({
          status: "error",
          message: "You already have a cohort with this title. Please use a unique title.",
        });
        return;
      }
      next(err);
    }
  }

  async updateCohort(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = req.params.id as string;
      const user = { userId: req.user!.userId, role: req.user!.role };
      const updated = await cohortService.updateCohort(id, req.body, user);
      res.status(200).json({ status: "success", data: updated });
    } catch (err: any) {
      if (err.message === "COHORT_NOT_FOUND") {
        res.status(404).json({ status: "error", message: "Cohort not found" });
        return;
      }
      if (err.message === "FORBIDDEN_COHORT_MANAGE") {
        res.status(403).json({ status: "error", message: "You are not authorized to modify this cohort" });
        return;
      }
      next(err);
    }
  }

  async deleteCohort(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = req.params.id as string;
      const instructorId = req.user!.userId;
      const role = req.user!.role;

      await cohortService.deleteCohort(id, instructorId, role);
      res.status(200).json({ status: "success", message: "Cohort deleted successfully" });
    } catch (err: any) {
      if (err.message === "COHORT_NOT_FOUND") {
        res.status(404).json({ status: "error", message: "Cohort not found" });
        return;
      }
      if (err.message === "FORBIDDEN_DELETE") {
        res.status(403).json({ status: "error", message: "You are not authorized to delete this cohort" });
        return;
      }
      if (err.message === "CANNOT_DELETE_ACTIVE_ENROLLMENTS") {
        res.status(400).json({
          status: "error",
          message: "Cannot delete this cohort because students are already enrolled. Consider archiving it instead.",
        });
        return;
      }
      next(err);
    }
  }

  async getCurriculum(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const cohortId = req.params.id as string;
      const userId = req.user!.userId;
      const userRole = req.user?.role;

      const curriculum = await cohortService.getCohortCurriculum(cohortId, userId, userRole);
      res.status(200).json({ status: "success", data: curriculum });
    } catch (err: any) {
      if (err.message === "COHORT_NOT_FOUND") {
        res.status(404).json({ status: "error", message: "Cohort not found." });
        return;
      }
      if (err.message === "FORBIDDEN_NOT_ENROLLED") {
        res.status(403).json({
          status: "error",
          message: "You must enroll in this cohort to access the curriculum and video sessions.",
        });
        return;
      }
      next(err);
    }
  }

  async startLive(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = req.params.id as string;
      const { zoomUrl } = req.body;
      const user = { userId: req.user!.userId, role: req.user!.role };

      const updated = await cohortService.startLiveSession(id, zoomUrl, user);
      res.status(200).json({ status: "success", data: updated });
    } catch (err: any) {
      if (err.message === "COHORT_NOT_FOUND") {
        res.status(404).json({ status: "error", message: "Cohort not found" });
        return;
      }
      if (err.message === "FORBIDDEN_COHORT_MANAGE") {
        res.status(403).json({ status: "error", message: "You are not authorized to start live sessions for this cohort" });
        return;
      }
      if (err.message === "INVALID_LIVE_URL") {
        res.status(400).json({ status: "error", message: "A valid https:// meeting URL is required" });
        return;
      }
      next(err);
    }
  }

  async endLive(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = req.params.id as string;
      const user = { userId: req.user!.userId, role: req.user!.role };

      const updated = await cohortService.endLiveSession(id, user);
      res.status(200).json({ status: "success", data: updated });
    } catch (err: any) {
      if (err.message === "COHORT_NOT_FOUND") {
        res.status(404).json({ status: "error", message: "Cohort not found" });
        return;
      }
      if (err.message === "FORBIDDEN_COHORT_MANAGE") {
        res.status(403).json({ status: "error", message: "You are not authorized to end live sessions for this cohort" });
        return;
      }
      next(err);
    }
  }
}