import { Router } from "express";
import { ContentController } from "../controllers/content.controller.js";
import { authenticate, authorize } from "../middlewares/auth.middleware.js";
import { Role } from "@prisma/client";
import { uploadLimiter, playbackLimiter } from "../middlewares/rateLimiter.js";

const router = Router();
const contentController = new ContentController();

// Instructor routes to add curriculum folders and items
router.post(
  "/cohorts/:cohortId/folders",
  authenticate,
  authorize(Role.INSTRUCTOR, Role.ADMIN),
  (req, res, next) => contentController.createFolder(req, res, next)
);

// Folder management
router.put(
  "/folders/:folderId",
  authenticate,
  authorize(Role.INSTRUCTOR, Role.ADMIN),
  (req, res, next) => contentController.updateFolder(req, res, next)
);

router.delete(
  "/folders/:folderId",
  authenticate,
  authorize(Role.INSTRUCTOR, Role.ADMIN),
  (req, res, next) => contentController.deleteFolder(req, res, next)
);

// Content asset management
router.post(
  "/folders/:folderId/contents",
  authenticate,
  authorize(Role.INSTRUCTOR, Role.ADMIN),
  (req, res, next) => contentController.createContent(req, res, next)
);

router.delete(
  "/contents/:id",
  authenticate,
  authorize(Role.INSTRUCTOR, Role.ADMIN),
  (req, res, next) => contentController.deleteContent(req, res, next)
);

router.post(
  "/contents/upload-url",
  authenticate,
  authorize(Role.INSTRUCTOR, Role.ADMIN),
  uploadLimiter,
  (req, res, next) => contentController.getUploadPresignedUrl(req, res, next)
);

router.post("/contents/:id/heartbeat", authenticate, playbackLimiter, (req, res, next) =>
  contentController.handleHeartbeat(req, res, next)
);

// Auto-Resume: Get saved watched progress
router.get("/contents/:id/progress", authenticate, playbackLimiter, (req, res, next) =>
  contentController.getContentProgress(req, res, next)
);

// --- Multipart Upload Routes for Large Videos ---
router.post(
  "/contents/multipart/initiate",
  authenticate,
  authorize(Role.INSTRUCTOR, Role.ADMIN),
  uploadLimiter,
  (req, res, next) => contentController.initiateMultipartUpload(req, res, next)
);

router.post(
  "/contents/multipart/sign-part",
  authenticate,
  authorize(Role.INSTRUCTOR, Role.ADMIN),
  (req, res, next) => contentController.getPresignedPartUrl(req, res, next)
);

router.post(
  "/contents/multipart/complete",
  authenticate,
  authorize(Role.INSTRUCTOR, Role.ADMIN),
  (req, res, next) => contentController.completeMultipartUpload(req, res, next)
);

// Secure streaming & access URL for enrolled students
router.get("/contents/:id/access-url", authenticate, playbackLimiter, (req, res, next) =>
  contentController.getSecureUrl(req, res, next)
);

export default router;