import { Request, Response, NextFunction } from "express";
import { ContentService, ALLOWED_VIDEO_TYPES } from "../services/content.service.js";
import { generateUploadPresignedUrl } from "../config/s3.js";
import { generateCloudFrontCookies } from "../config/cloudfrontSigner.js";
import prisma from "../config/db.js";
import { env } from "../config/env.js";

const contentService = new ContentService();

export class ContentController {
  async createFolder(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const cohortId = req.params.cohortId as string;
      const { title, order } = req.body;
      const user = { userId: req.user!.userId, role: req.user!.role };

      if (!title) {
        res.status(400).json({ status: "error", message: "Folder title is required" });
        return;
      }

      const folder = await contentService.addFolder({ title, cohortId, order }, user);
      res.status(201).json({ status: "success", data: folder });
    } catch (err: any) {
      if (err.message === "COHORT_NOT_FOUND") {
        res.status(404).json({ status: "error", message: "Cohort not found" });
        return;
      }
      if (err.message === "FORBIDDEN_COHORT_MANAGE") {
        res.status(403).json({ status: "error", message: "You are not authorized to add folders to this cohort" });
        return;
      }
      next(err);
    }
  }

  async updateFolder(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const folderId = req.params.folderId as string;
      const { title } = req.body;
      const user = { userId: req.user!.userId, role: req.user!.role };

      if (!title || !title.trim()) {
        res.status(400).json({ status: "error", message: "Folder title is required" });
        return;
      }

      const updated = await contentService.updateFolder(folderId, title, user);
      res.status(200).json({ status: "success", data: updated });
    } catch (err: any) {
      if (err.message === "FOLDER_NOT_FOUND") {
        res.status(404).json({ status: "error", message: "Folder not found" });
        return;
      }
      if (err.message === "FORBIDDEN_COHORT_MANAGE") {
        res.status(403).json({ status: "error", message: "You are not authorized to edit folders in this cohort" });
        return;
      }
      next(err);
    }
  }

  async deleteFolder(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const folderId = req.params.folderId as string;
      const user = { userId: req.user!.userId, role: req.user!.role };

      await contentService.deleteFolder(folderId, user);
      res.status(200).json({ status: "success", message: "Folder deleted" });
    } catch (err: any) {
      if (err.message === "FOLDER_NOT_FOUND") {
        res.status(404).json({ status: "error", message: "Folder not found" });
        return;
      }
      if (err.message === "FORBIDDEN_COHORT_MANAGE") {
        res.status(403).json({ status: "error", message: "You are not authorized to delete folders in this cohort" });
        return;
      }
      next(err);
    }
  }

  async createContent(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const folderId = req.params.folderId as string;
      const { title, type, videoAssetId, resourceDoc, durationSec, order } = req.body;
      const user = { userId: req.user!.userId, role: req.user!.role };

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
      }, user);

      res.status(201).json({ status: "success", data: content });
    } catch (err: any) {
      if (err.message === "FOLDER_NOT_FOUND") {
        res.status(404).json({ status: "error", message: "Folder not found" });
        return;
      }
      if (err.message === "FORBIDDEN_COHORT_MANAGE") {
        res.status(403).json({ status: "error", message: "You are not authorized to add content to this cohort" });
        return;
      }
      if (err.message === "INVALID_CONTENT_TYPE") {
        res.status(400).json({ status: "error", message: "Invalid content type provided" });
        return;
      }
      if (err.message === "VIDEO_ASSET_NOT_FOUND") {
        res.status(404).json({ status: "error", message: "Referenced video asset does not exist" });
        return;
      }
      next(err);
    }
  }

  async deleteContent(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = req.params.id as string;
      const user = { userId: req.user!.userId, role: req.user!.role };

      await contentService.deleteContent(id, user);
      res.status(200).json({ status: "success", message: "Content deleted" });
    } catch (err: any) {
      if (err.message === "CONTENT_NOT_FOUND") {
        res.status(404).json({ status: "error", message: "Content not found" });
        return;
      }
      if (err.message === "FORBIDDEN_COHORT_MANAGE") {
        res.status(403).json({ status: "error", message: "You are not authorized to delete content from this cohort" });
        return;
      }
      next(err);
    }
  }

  async getSecureUrl(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = req.params.id as string;
      const userId = req.user!.userId;
      const userRole = req.user!.role;

      const data = await contentService.getSecureContentUrl(id, userId, userRole);
      let signedCookies: ReturnType<typeof generateCloudFrontCookies> | undefined;

      let isCdnStream = data.url.includes("cloudfront.net") || data.url.endsWith(".m3u8");
      if (!isCdnStream && env.CLOUDFRONT_DOMAIN) {
        try {
          const cdnHost = new URL(env.CLOUDFRONT_DOMAIN.startsWith("http") ? env.CLOUDFRONT_DOMAIN : `https://${env.CLOUDFRONT_DOMAIN}`).hostname;
          isCdnStream = data.url.includes(cdnHost);
        } catch {
          // ignore hostname parsing errors
        }
      }

      if (isCdnStream) {
        try {
          // Scope cookie resource to the specific lecture HLS directory instead of wildcard /*
          const urlObj = new URL(data.url);
          const pathSegments = urlObj.pathname.split("/");
          pathSegments.pop(); // remove master.m3u8
          const directoryPath = pathSegments.join("/");
          const scopedResource = `${urlObj.origin}${directoryPath}/*`;

          // Generate cookies scoped strictly to this lesson path with a 2-hour lifetime
          const cookies = generateCloudFrontCookies(scopedResource, 2 * 60 * 60);
          signedCookies = cookies;
          const cookieOptions = {
            httpOnly: true,
            secure: true,
            sameSite: "none" as const,
            maxAge: 2 * 60 * 60 * 1000, // 2 hours
          };

          res.cookie("CloudFront-Policy", cookies["CloudFront-Policy"], cookieOptions);
          res.cookie("CloudFront-Signature", cookies["CloudFront-Signature"], cookieOptions);
          res.cookie("CloudFront-Key-Pair-Id", cookies["CloudFront-Key-Pair-Id"], cookieOptions);
        } catch (cookieErr) {
          console.warn("⚠️ [CloudFront Signer] Could not issue signed cookies:", cookieErr);
        }
      }

      res.status(200).json({
        status: "success",
        data: {
          ...data,
          cookies: signedCookies,
        },
      });
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

      if (!ALLOWED_VIDEO_TYPES.includes(contentType.toLowerCase())) {
        res.status(400).json({
          status: "error",
          code: "UNSUPPORTED_VIDEO_FORMAT",
          message: `Unsupported format. Allowed MIME types: ${ALLOWED_VIDEO_TYPES.join(", ")}`,
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