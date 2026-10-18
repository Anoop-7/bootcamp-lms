import { Request, Response, NextFunction } from "express";
import { ContentService } from "../services/content.service.js";
import { generateUploadPresignedUrl } from "../config/s3.js";
import { generateCloudFrontCookies } from "../config/cloudfrontSigner.js";
import prisma from "../config/db.js";

const contentService = new ContentService();

export class ContentController {
  async createFolder(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const cohortId = req.params.cohortId as string;
      const { title, order } = req.body;
      if (!title) {
        res.status(400).json({ status: "error", message: "Folder title is required" });
        return;
      }

      const folder = await contentService.addFolder({ title, cohortId, order });
      res.status(201).json({ status: "success", data: folder });
    } catch (err: any) {
      next(err);
    }
  }

  async updateFolder(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const folderId = req.params.folderId as string;
      const { title } = req.body;
      if (!title || !title.trim()) {
        res.status(400).json({ status: "error", message: "Folder title is required" });
        return;
      }
      const updated = await contentService.updateFolder(folderId, title);
      res.status(200).json({ status: "success", data: updated });
    } catch (err: any) {
      next(err);
    }
  }

  async deleteFolder(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const folderId = req.params.folderId as string;
      await contentService.deleteFolder(folderId);
      res.status(200).json({ status: "success", message: "Folder deleted" });
    } catch (err: any) {
      next(err);
    }
  }

  async createContent(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const folderId = req.params.folderId as string;
      const { title, type, videoAssetId, resourceDoc, durationSec, order } = req.body;

      if (!title || !type) {
        res.status(400).json({ status: "error", message: "Content title and type are required" });
        return;
      }

      const content = await contentService.addContent({
        title,
        type,
        folderId,
        videoAssetId,
        resourceDoc,
        durationSec,
        order,
      });

      res.status(201).json({ status: "success", data: content });
    } catch (err: any) {
      next(err);
    }
  }

  async deleteContent(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = req.params.id as string;
      await contentService.deleteContent(id);
      res.status(200).json({ status: "success", message: "Content deleted" });
    } catch (err: any) {
      next(err);
    }
  }

  async getSecureUrl(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = req.params.id as string;
      const userId = req.user!.userId;
      const userRole = req.user!.role;

      const data = await contentService.getSecureContentUrl(id, userId, userRole);

      // Issue CloudFront Signed Cookies for HLS streams
      if (data.url.includes("cloudfront.net")) {
        try {
          const cookies = generateCloudFrontCookies("/*");
          const cookieOptions = {
            httpOnly: true,
            secure: true,
            sameSite: "none" as const,
            maxAge: 6 * 60 * 60 * 1000,
          };

          res.cookie("CloudFront-Policy", cookies["CloudFront-Policy"], cookieOptions);
          res.cookie("CloudFront-Signature", cookies["CloudFront-Signature"], cookieOptions);
          res.cookie("CloudFront-Key-Pair-Id", cookies["CloudFront-Key-Pair-Id"], cookieOptions);

          // Return cookies in JSON payload for cross-origin HLS client loaders
          (data as any).cookies = cookies;
        } catch (cookieErr) {
          console.warn("⚠️ [CloudFront Signer] Could not issue signed cookies:", cookieErr);
        }
      }

      res.status(200).json({ status: "success", data });
    } catch (err: any) {
      if (err.message === "CONTENT_NOT_FOUND") {
        res.status(404).json({ status: "error", message: "Content not found" });
        return;
      }
      if (err.message === "NOT_ENROLLED") {
        res.status(403).json({ status: "error", message: "You must be enrolled to view this content" });
        return;
      }
      if (err.message === "VIDEO_STILL_PROCESSING") {
        res.status(400).json({ status: "error", message: "Video is still transcoding. Please check back shortly." });
        return;
      }
      next(err);
    }
  }

  // Auto-Resume: Fetch current student watch progress for this content
  async getContentProgress(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const contentId = req.params.id as string;
      const userId = req.user!.userId;

      const progress = await prisma.watchProgress.findUnique({
        where: { userId_contentId: { userId, contentId } },
        select: { watchedSeconds: true, isCompleted: true },
      });

      res.status(200).json({ status: "success", data: progress });
    } catch (err: any) {
      next(err);
    }
  }

  async getUploadPresignedUrl(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { filename, contentType } = req.body;

      if (!filename || !contentType) {
        res.status(400).json({
          status: "error",
          message: "filename and contentType are required",
        });
        return;
      }

      const { uploadUrl, key } = await generateUploadPresignedUrl(filename, contentType);

      res.status(200).json({
        status: "success",
        data: {
          uploadUrl,
          key,
        },
      });
    } catch (err: any) {
      next(err);
    }
  }

  async handleHeartbeat(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const contentId = req.params.id as string;
      const userId = req.user!.userId;
      const { watchedSeconds, sessionToken } = req.body;

      if (watchedSeconds === undefined || !sessionToken) {
        res.status(400).json({ status: "error", message: "watchedSeconds and sessionToken are required" });
        return;
      }

      const data = await contentService.processHeartbeat(userId, contentId, Number(watchedSeconds), sessionToken);
      res.status(200).json({ status: "success", data });
    } catch (err: any) {
      if (err.message === "SESSION_EXPIRED_OR_REPLACED") {
        res.status(401).json({ status: "error", code: "SESSION_REPLACED", message: "Playback started on another device." });
        return;
      }
      next(err);
    }
  }

  // --- Multipart Upload Controllers for Large Videos ---

  async initiateMultipartUpload(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { filename, contentType } = req.body;
      if (!filename || !contentType) {
        res.status(400).json({ status: "error", message: "filename and contentType are required" });
        return;
      }

      const data = await contentService.initiateUpload(filename, contentType);
      res.status(200).json({ status: "success", data });
    } catch (err: any) {
      next(err);
    }
  }

  async getPresignedPartUrl(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { key, uploadId, partNumber } = req.body;
      if (!key || !uploadId || !partNumber) {
        res.status(400).json({ status: "error", message: "key, uploadId, and partNumber are required" });
        return;
      }

      const data = await contentService.getPartUrl(key, uploadId, Number(partNumber));
      res.status(200).json({ status: "success", data });
    } catch (err: any) {
      next(err);
    }
  }

  async completeMultipartUpload(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { key, uploadId, parts, videoAssetId } = req.body;
      if (!key || !uploadId || !parts || !Array.isArray(parts)) {
        res.status(400).json({ status: "error", message: "key, uploadId, and parts array are required" });
        return;
      }

      const data = await contentService.completeUpload(key, uploadId, parts, videoAssetId);
      res.status(200).json({ status: "success", data });
    } catch (err: any) {
      next(err);
    }
  }
}