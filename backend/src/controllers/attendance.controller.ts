import { Request, Response, NextFunction } from "express";
import { AttendanceService } from "../services/attendance.service.js";

const attendanceService = new AttendanceService();

export class AttendanceController {
  /**
   * Validates student enrollment, logs their presence in LiveAttendance,
   * and securely returns the meeting link.
   */
  async joinLive(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const { id: cohortId } = req.params as { id: string };

      const liveUrl = await attendanceService.joinLiveSession(userId, cohortId);

      res.status(200).json({
        status: "success",
        data: {
          meetingUrl: liveUrl,
        },
      });
    } catch (error: any) {
      if (error.message === "NO_ACTIVE_LIVE_SESSION") {
        res.status(400).json({
          status: "error",
          message: "There is no live session in progress for this cohort right now.",
        });
        return;
      }
      if (error.message === "NOT_ENROLLED") {
        res.status(403).json({
          status: "error",
          message: "You are not enrolled in this cohort.",
        });
        return;
      }
      if (error.message === "COHORT_NOT_FOUND") {
        res.status(404).json({
          status: "error",
          message: "Cohort not found.",
        });
        return;
      }
      next(error);
    }
  }

  /**
   * Fetches attendee logs for the instructor dashboard.
   */
  async getAttendance(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { userId, role } = req.user!;
      const { id: cohortId } = req.params as { id: string };

      const attendees = await attendanceService.getAttendanceList(cohortId, userId, role);

      res.status(200).json({
        status: "success",
        data: attendees,
      });
    } catch (error: any) {
      if (error.message === "UNAUTHORIZED") {
        res.status(403).json({
          status: "error",
          message: "You are not authorized to view attendance logs for this cohort.",
        });
        return;
      }
      next(error);
    }
  }
}