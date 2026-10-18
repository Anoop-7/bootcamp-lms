import { Router } from "express";
import { ProgressController } from "../controllers/progress.controller.js";
import { authenticate } from "../middlewares/auth.middleware.js";

const router = Router();
const controller = new ProgressController();

// Tracking routes for students
router.post("/contents/:contentId/progress", authenticate, controller.updateProgress);
router.get("/contents/:contentId/progress", authenticate, controller.getContentProgress);
router.get("/cohorts/:cohortId/progress", authenticate, controller.getCohortProgress);

export default router;