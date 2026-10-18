import { Router } from "express";
import { AdminController } from "../controllers/admin.controller.js";
import { authenticate, authorize } from "../middlewares/auth.middleware.js";
import { Role } from "@prisma/client";

const router = Router();
const adminController = new AdminController();

router.use(authenticate, authorize(Role.ADMIN));

// Invite management
router.post("/invites", (req, res, next) => adminController.createInvite(req, res, next));
router.get("/invites", (req, res, next) => adminController.listInvites(req, res, next));
router.patch("/invites/:id/revoke", (req, res, next) => adminController.revokeInvite(req, res, next));
router.post("/invites/:id/resend", (req, res, next) => adminController.resendInvite(req, res, next));
router.delete("/invites/:id", (req, res, next) => adminController.deleteInvite(req, res, next));

// Platform User & Role Governance
router.get("/users", (req, res, next) => adminController.listUsers(req, res, next));
router.patch("/users/:id/role", (req, res, next) => adminController.updateUserRole(req, res, next));

// Cohort & Enrollment Management
router.get("/cohorts", (req, res, next) => adminController.listCohorts(req, res, next));
router.patch("/cohorts/:id/status", (req, res, next) => adminController.updateCohortStatus(req, res, next));
router.get("/cohorts/:id/enrollments", (req, res, next) => adminController.getCohortEnrollments(req, res, next));
router.post("/cohorts/:id/enroll", (req, res, next) => adminController.manualEnroll(req, res, next));
router.delete("/cohorts/:id/enroll/:userId", (req, res, next) => adminController.revokeEnrollment(req, res, next));

export default router;