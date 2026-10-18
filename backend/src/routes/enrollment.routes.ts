import { Router } from "express";
import { EnrollmentController } from "../controllers/enrollment.controller.js";
import { authenticate } from "../middlewares/auth.middleware.js";

const router = Router();
const controller = new EnrollmentController();

// Student routes
router.post("/cohorts/:cohortId/enroll", authenticate, controller.enrollInCohort);
router.get("/enrollments/my", authenticate, controller.getMyEnrollments);

export default router;