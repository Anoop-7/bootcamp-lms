import { Router } from "express";
import { AuthController } from "../controllers/auth.controller.js";
import { authenticate } from "../middlewares/auth.middleware.js";
import { AuthResetController } from "../controllers/authReset.controller.js";

const router = Router();
const authController = new AuthController();
const resetController = new AuthResetController();

router.post("/register", (req, res, next) => authController.register(req, res, next));
router.post("/login", (req, res, next) => authController.login(req, res, next));
router.get("/me", authenticate, (req, res, next) => authController.me(req, res, next));

// Public forgot/reset endpoints
router.post("/forgot-password", (req, res, next) => resetController.forgotPassword(req, res, next));
router.post("/reset-password", (req, res, next) => resetController.resetPassword(req, res, next));

// Authenticated in-app profile password reset
router.put("/profile/password", authenticate, (req, res, next) => resetController.changePasswordProfile(req, res, next));

// Instructor invite onboarding routes
router.get("/invites/:token", (req, res, next) => authController.verifyInvite(req, res, next));
router.post("/register-invited-instructor", (req, res, next) => authController.registerInvitedInstructor(req, res, next));

export default router;