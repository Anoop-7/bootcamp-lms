import { Router } from "express";
import { CohortController } from "../controllers/cohort.controller.js";
import { authenticate, authorize, optionalAuthenticate } from "../middlewares/auth.middleware.js";
import { AttendanceController } from "../controllers/attendance.controller.js";
import { Role } from "@prisma/client";

const router = Router();
const cohortController = new CohortController();
const attendanceController = new AttendanceController();

// 1. Dedicated Instructor Route (MUST be before /:slug)
router.get(
  "/instructor/me",
  authenticate,
  authorize(Role.INSTRUCTOR, Role.ADMIN),
  (req, res, next) => cohortController.getInstructorCohorts(req, res, next)
);

// 2. Public discovery (List all cohorts)
router.get("/", optionalAuthenticate, (req, res, next) =>
  cohortController.getCohorts(req, res, next)
);

// 3. Classroom / Learning Player Endpoint (Used by CoursePlayer.tsx)
router.get("/:id/curriculum", authenticate, (req, res, next) =>
  cohortController.getCurriculum(req, res, next)
);

// 4. Instructor / Admin management routes
router.post(
  "/",
  authenticate,
  authorize(Role.INSTRUCTOR, Role.ADMIN),
  (req, res, next) => cohortController.createCohort(req, res, next)
);

router.put(
  "/:id",
  authenticate,
  authorize(Role.INSTRUCTOR, Role.ADMIN),
  (req, res, next) => cohortController.updateCohort(req, res, next)
);

router.delete(
  "/:id",
  authenticate,
  authorize(Role.INSTRUCTOR, Role.ADMIN),
  (req, res, next) => cohortController.deleteCohort(req, res, next)
);

router.post(
  "/:id/start-live",
  authenticate,
  authorize(Role.INSTRUCTOR, Role.ADMIN),
  (req, res, next) => cohortController.startLive(req, res, next)
);

router.post(
  "/:id/end-live",
  authenticate,
  authorize(Role.INSTRUCTOR, Role.ADMIN),
  (req, res, next) => cohortController.endLive(req, res, next)
);

// 5. Student live access & Attendance logs
router.get("/:id/join-live", authenticate, attendanceController.joinLive);
router.get(
  "/:id/attendance",
  authenticate,
  authorize(Role.INSTRUCTOR, Role.ADMIN),
  attendanceController.getAttendance
);

// 6. General Cohort Details by Slug or ID (Placed at bottom so subpaths are not caught as slugs)
router.get("/:slug", optionalAuthenticate, (req, res, next) =>
  cohortController.getCohortBySlug(req, res)
);

export default router;