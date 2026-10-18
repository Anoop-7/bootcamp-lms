import { Request, Response, NextFunction } from "express";
import { ProgressService } from "../services/progress.service.js";

const progressService = new ProgressService();

export class ProgressController {
  async updateProgress(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const { contentId } = req.params as { contentId: string };
      const { watchedSeconds, isCompleted } = req.body;

      if (watchedSeconds === undefined || typeof watchedSeconds !== "number") {
        res.status(400).json({
          status: "error",
          message: "Field 'watchedSeconds' is required and must be a number",
        });
        return;
      }

      const progress = await progressService.updateProgress({
        userId,
        contentId,
        watchedSeconds,
        isCompleted,
      });

      res.status(200).json({
        status: "success",
        data: progress,
      });
    } catch (error) {
      next(error);
    }
  }

  async getContentProgress(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const { contentId } = req.params as { contentId: string };

      const progress = await progressService.getContentProgress(userId, contentId);

      res.status(200).json({
        status: "success",
        data: progress,
      });
    } catch (error) {
      next(error);
    }
  }

  async getCohortProgress(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const { cohortId } = req.params as { cohortId: string };

      const progressList = await progressService.getCohortProgress(userId, cohortId);

      res.status(200).json({
        status: "success",
        data: progressList,
      });
    } catch (error) {
      next(error);
    }
  }
}