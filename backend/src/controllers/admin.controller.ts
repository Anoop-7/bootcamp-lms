import { Request, Response, NextFunction } from "express";
import { InviteService } from "../services/invite.service.js";
import { AdminService } from "../services/admin.service.js";
import { Role, CohortStatus } from "@prisma/client";

const inviteService = new InviteService();
const adminService = new AdminService();

export class AdminController {
  // --- Invite & User Methods ---
  async createInvite(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { email, role } = req.body;
      const adminId = req.user!.userId;

      if (!email || !email.includes("@")) {
        res.status(400).json({ status: "error", message: "A valid email address is required" });
        return;
      }

      const assignedRole = role === Role.ADMIN ? Role.ADMIN : Role.INSTRUCTOR;
      const result = await inviteService.createInstructorInvite(email, adminId, assignedRole);
      res.status(201).json({
        status: "success",
        message: `${assignedRole} invitation created successfully`,
        data: result,
      });
    } catch (err: any) {
      if (err.message === "USER_ALREADY_INSTRUCTOR") {
        res.status(400).json({ status: "error", message: "This email is already an active instructor." });
        return;
      }
      if (err.message === "USER_ALREADY_ADMIN") {
        res.status(400).json({ status: "error", message: "This email is already an active administrator." });
        return;
      }
      if (err.message === "USER_IS_ADMIN") {
        res.status(400).json({ status: "error", message: "This email belongs to an existing platform administrator." });
        return;
      }
      next(err);
    }
  }

  async listInvites(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const invites = await inviteService.listInvites();
      res.status(200).json({ status: "success", data: invites });
    } catch (err: any) {
      next(err);
    }
  }

  async revokeInvite(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      await inviteService.revokeInvite(id as string);
      res.status(200).json({ status: "success", message: "Invite successfully revoked." });
    } catch (err: any) {
      if (err.message === "CANNOT_REVOKE_ACCEPTED_INVITE") {
        res.status(400).json({ status: "error", message: "Cannot revoke an invitation that has already been accepted." });
        return;
      }
      next(err);
    }
  }

  async resendInvite(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const adminId = req.user!.userId;
      const result = await inviteService.resendInvite(id as string, adminId);
      res.status(200).json({ status: "success", message: "Invite extended with fresh 48-hour token.", data: result });
    } catch (err: any) {
      if (err.message === "INVITE_ALREADY_ACCEPTED") {
        res.status(400).json({ status: "error", message: "This candidate has already accepted their invite." });
        return;
      }
      next(err);
    }
  }

  async deleteInvite(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      await inviteService.deleteInvite(id as string);
      res.status(200).json({ status: "success", message: "Invitation record deleted successfully." });
    } catch (err: any) {
      if (err.message === "CANNOT_DELETE_ACCEPTED_INVITE") {
        res.status(400).json({ status: "error", message: "Cannot delete an accepted onboarding invite." });
        return;
      }
      if (err.message === "REVOKE_BEFORE_DELETE") {
        res.status(400).json({ status: "error", message: "Please revoke the active invite before deleting it." });
        return;
      }
      next(err);
    }
  }

  async listUsers(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const users = await inviteService.listUsers();
      res.status(200).json({ status: "success", data: users });
    } catch (err: any) {
      next(err);
    }
  }

  async updateUserRole(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const { role } = req.body;
      const currentAdminId = req.user!.userId;

      if (!role || !Object.values(Role).includes(role)) {
        res.status(400).json({ status: "error", message: "Invalid role provided." });
        return;
      }

      const updated = await inviteService.updateUserRole(id as string, role, currentAdminId);
      res.status(200).json({ status: "success", message: `User role updated to ${role}.`, data: updated });
    } catch (err: any) {
      if (err.message === "CANNOT_DEMOTE_SELF") {
        res.status(400).json({ status: "error", message: "Security guard: You cannot demote your own administrator account." });
        return;
      }
      next(err);
    }
  }

  // --- Cohort & Enrollment Management ---
  async listCohorts(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const cohorts = await adminService.listAllCohorts();
      res.status(200).json({ status: "success", data: cohorts });
    } catch (err: any) {
      next(err);
    }
  }

  async updateCohortStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const { status, isLiveActive } = req.body;

      if (status && !Object.values(CohortStatus).includes(status)) {
        res.status(400).json({ status: "error", message: "Invalid cohort status" });
        return;
      }

      const updated = await adminService.updateCohortStatus(id as string, status, isLiveActive);
      res.status(200).json({ status: "success", data: updated });
    } catch (err: any) {
      next(err);
    }
  }

  async getCohortEnrollments(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const enrollments = await adminService.getCohortEnrollments(id as string);
      res.status(200).json({ status: "success", data: enrollments });
    } catch (err: any) {
      next(err);
    }
  }

  async manualEnroll(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const { email } = req.body;

      if (!email || !email.includes("@")) {
        res.status(400).json({ status: "error", message: "A valid student email is required" });
        return;
      }

      const enrollment = await adminService.manualEnrollStudent(id as string, email);
      res.status(201).json({ status: "success", message: "Student enrolled successfully", data: enrollment });
    } catch (err: any) {
      if (err.message === "USER_NOT_FOUND") {
        res.status(404).json({ status: "error", message: "No registered user found with this email" });
        return;
      }
      if (err.message === "ALREADY_ENROLLED") {
        res.status(400).json({ status: "error", message: "Student is already enrolled in this cohort" });
        return;
      }
      next(err);
    }
  }

  async revokeEnrollment(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id, userId } = req.params;
      await adminService.revokeEnrollment(id as string, userId as string);
      res.status(200).json({ status: "success", message: "Enrollment revoked successfully" });
    } catch (err: any) {
      next(err);
    }
  }
}