import { Router } from "express";
import { AuthController } from "../controllers/auth.controller.js";
import { AuthResetController } from "../controllers/authReset.controller.js";
import { authenticate } from "../middlewares/auth.middleware.js";
import {
  loginLimiter,
  registerLimiter,
  forgotPasswordLimiter,
  resetPasswordLimiter,
  inviteLimiter,
} from "../middlewares/rateLimiter.js";

const router = Router();
const authController = new AuthController();
const resetController = new AuthResetController();

// Registration with Rate Limiting
router.post("/register/initiate", registerLimiter, (req, res, next) =>
  authController.initiateRegister(req, res, next)
);
router.post("/register/verify", registerLimiter, (req, res, next) =>
  authController.completeRegister(req, res, next)
);

// Login with Brute-Force Rate Limiting
router.post("/login", loginLimiter, (req, res, next) =>
  authController.login(req, res, next)
);

// Identity self-lookup
router.get("/me", authenticate, (req, res, next) =>
  authController.me(req, res, next)
);

// Password Reset endpoints with Rate Limiting
router.post("/forgot-password", forgotPasswordLimiter, (req, res, next) =>
  resetController.forgotPassword(req, res, next)
);
router.post("/reset-password", resetPasswordLimiter, (req, res, next) =>
  resetController.resetPassword(req, res, next)
);
router.patch("/profile/password", authenticate, (req, res, next) =>
  resetController.changePasswordProfile(req, res, next)
);

// Privileged Onboarding Token routes with Rate Limiting
router.get("/invites/:token", inviteLimiter, (req, res, next) =>
  authController.verifyInvite(req, res, next)
);
router.post("/register-invited-instructor", inviteLimiter, (req, res, next) =>
  authController.registerInvitedInstructor(req, res, next)
);

export default router;