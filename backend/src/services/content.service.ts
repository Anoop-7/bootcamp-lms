import { ContentRepository } from "../repositories/content.repository.js";
import { 
  getPresignedDownloadUrl, 
  initiateMultipartUpload, 
  getPresignedPartUrl, 
  completeMultipartUpload 
} from "../config/s3.js";
import { ContentType, Role, VideoStatus } from "@prisma/client";
import prisma from "../config/db.js";
import crypto from "crypto";
import { env } from "../config/env.js";
import { 
  badRequest, 
  notFound, 
  forbidden, 
  unauthorized 
} from "../utils/httpError.js";

const contentRepository = new ContentRepository();

export const ALLOWED_VIDEO_TYPES = [
  "video/mp4",
  "video/quicktime",
  "video/x-matroska",
  "video/webm",
  "video/x-m4v",
];

export class ContentService {
  /**
   * Helper: Resolves and checks cohort ownership from a cohortId
   */
  async assertCanManageCohort(cohortId: string, user: { userId: string; role: string }) {
    const cohort = await prisma.cohort.findUnique({
      where: { id: cohortId },
      select: { id: true, instructorId: true },
    });
    if (!cohort) {
      throw notFound("Cohort not found", "COHORT_NOT_FOUND");
    }
    if (user.role !== "ADMIN" && cohort.instructorId !== user.userId) {
      throw forbidden("You are not authorized to manage this cohort", "FORBIDDEN_COHORT_MANAGE");
    }
  }

  /**
   * Helper: Resolves cohort ownership from a folderId
   */
  async assertCanManageFolder(folderId: string, user: { userId: string; role: string }) {
    const folder = await prisma.folder.findUnique({
      where: { id: folderId },
      select: { cohortId: true },
    });
    if (!folder) {
      throw notFound("Curriculum module not found", "FOLDER_NOT_FOUND");
    }
    await this.assertCanManageCohort(folder.cohortId, user);
  }

  /**
   * Helper: Resolves cohort ownership from a contentId
   */
  async assertCanManageContent(contentId: string, user: { userId: string; role: string }) {
    const content = await prisma.content.findUnique({
      where: { id: contentId },
      include: { folder: { select: { cohortId: true } } },
    });
    if (!content) {
      throw notFound("Content item not found", "CONTENT_NOT_FOUND");
    }
    await this.assertCanManageCohort(content.folder.cohortId, user);
  }

  async addFolder(data: { title: string; cohortId: string; order?: number }, user: { userId: string; role: string }) {
    await this.assertCanManageCohort(data.cohortId, user);
    return contentRepository.createFolder(data);
  }

  async updateFolder(folderId: string, title: string, user: { userId: string; role: string }) {
    await this.assertCanManageFolder(folderId, user);
    return prisma.folder.update({
      where: { id: folderId },
      data: { title: title.trim() },
    });
  }

  async deleteFolder(folderId: string, user: { userId: string; role: string }) {
    await this.assertCanManageFolder(folderId, user);
    return prisma.folder.delete({
      where: { id: folderId },
    });
  }

  async addContent(
    data: {
      title: string;
      type: ContentType;
      folderId: string;
      videoAssetId?: string;
      resourceDoc?: string;
      durationSec?: number;
      order?: number;
    },
    user: { userId: string; role: string }
  ) {
    await this.assertCanManageFolder(data.folderId, user);

    if (!Object.values(ContentType).includes(data.type)) {
      throw badRequest("Invalid content item type", "INVALID_CONTENT_TYPE");
    }

    if (data.videoAssetId) {
      const asset = await prisma.videoAsset.findUnique({
        where: { id: data.videoAssetId },
      });
      if (!asset) {
        throw notFound("Target video asset not found", "VIDEO_ASSET_NOT_FOUND");
      }
    }

    return contentRepository.createContent(data);
  }

  async deleteContent(contentId: string, user: { userId: string; role: string }) {
    await this.assertCanManageContent(contentId, user);
    return prisma.content.delete({
      where: { id: contentId },
    });
  }

  // --- Multipart Upload Pipeline ---

  async initiateUpload(filename: string, contentType: string, uploaderId?: string) {
    if (!contentType || !ALLOWED_VIDEO_TYPES.includes(contentType.toLowerCase())) {
      throw badRequest(
        `Unsupported format. Allowed MIME types: ${ALLOWED_VIDEO_TYPES.join(", ")}`,
        "UNSUPPORTED_VIDEO_FORMAT"
      );
    }

    const { uploadId, key } = await initiateMultipartUpload(filename, contentType);
    
    const videoAsset = await prisma.videoAsset.create({
      data: {
        originalKey: key,
        uploadId,
        uploadedById: uploaderId || null,
        status: VideoStatus.UPLOADING,
      },
    });

    return { uploadId, key, videoAssetId: videoAsset.id };
  }

  async getPartUrl(key: string, uploadId: string, partNumber: number) {
    if (partNumber < 1 || partNumber > 10000) {
      throw badRequest("Part number must be between 1 and 10000", "INVALID_PART_NUMBER");
    }
    const presignedUrl = await getPresignedPartUrl(key, uploadId, partNumber);
    return { presignedUrl };
  }

  async completeUpload(
    key: string,
    uploadId: string,
    parts: { ETag: string; PartNumber: number }[],
    videoAssetId?: string
  ) {
    if (!parts || parts.length === 0) {
      throw badRequest("Multipart parts payload cannot be empty", "PARTS_REQUIRED");
    }

    await completeMultipartUpload(key, uploadId, parts);

    if (videoAssetId) {
      await prisma.videoAsset.update({
        where: { id: videoAssetId },
        data: { status: VideoStatus.QUEUED },
      });
    }

    return { success: true, key, status: VideoStatus.QUEUED };
  }

  // --- Secure Playback & CloudFront CDN Handling ---

  async getSecureContentUrl(contentId: string, userId: string, userRole: Role) {
    const content = await prisma.content.findUnique({
      where: { id: contentId },
      include: { folder: true, videoAsset: true },
    });

    if (!content) {
      throw notFound("Content item not found", "CONTENT_NOT_FOUND");
    }

    if (content.videoAsset && content.videoAsset.status !== VideoStatus.READY) {
      throw badRequest("Video session is still processing and transcoding", "VIDEO_STILL_PROCESSING");
    }

    const cohortId = content.folder.cohortId;

    if (userRole !== Role.ADMIN && userRole !== Role.INSTRUCTOR) {
      const enrollment = await prisma.enrollment.findUnique({
        where: { userId_cohortId: { userId, cohortId } },
      });

      if (!enrollment) {
        throw forbidden("Enrollment required to access this curriculum session", "NOT_ENROLLED");
      }
    }

    const sessionToken = crypto.randomBytes(32).toString("hex");
    await prisma.user.update({
      where: { id: userId },
      data: { activeSessionToken: sessionToken },
    });

    const assetKey = content.videoAsset?.hlsManifestKey || content.videoAsset?.originalKey || content.resourceDoc;
    if (!assetKey) {
      throw notFound("No playback stream or resource is attached to this lesson", "NO_ASSET_ATTACHED");
    }

    if (assetKey.startsWith("http://") || assetKey.startsWith("https://")) {
      return { url: assetKey, isDirect: true, sessionToken };
    }

    const cloudfrontBase = env.CLOUDFRONT_DOMAIN;
    if (cloudfrontBase && assetKey.endsWith(".m3u8")) {
      const cleanDomain = cloudfrontBase.replace(/\/$/, "");
      const cleanKey = assetKey.replace(/^\//, "");
      const cdnUrl = cleanDomain.startsWith("http") ? `${cleanDomain}/${cleanKey}` : `https://${cleanDomain}/${cleanKey}`;
      return { url: cdnUrl, isDirect: false, sessionToken };
    }

    const bucket = env.AWS_S3_BUCKET;
    const presignedUrl = await getPresignedDownloadUrl(bucket, assetKey, 3600);

    return { url: presignedUrl, isDirect: false, sessionToken };
  }

  // --- Heartbeat & Monotonic Progress ---

  async processHeartbeat(userId: string, contentId: string, watchedSeconds: number, sessionToken: string) {
    if (typeof watchedSeconds !== "number" || !Number.isFinite(watchedSeconds) || watchedSeconds < 0) {
      throw badRequest("Invalid playback heartbeat position", "INVALID_HEARTBEAT");
    }

    // 1. Validate active session token (single-device enforcement)
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, role: true, activeSessionToken: true },
    });

    if (!user || user.activeSessionToken !== sessionToken) {
      throw unauthorized("Playback session expired or superseded by another playback tab", "SESSION_EXPIRED_OR_REPLACED");
    }

    // 2. Fetch content and parent cohort
    const content = await prisma.content.findUnique({
      where: { id: contentId },
      select: {
        id: true,
        durationSec: true,
        folder: {
          select: { cohortId: true },
        },
      },
    });

    if (!content) {
      throw notFound("Content lesson not found", "CONTENT_NOT_FOUND");
    }

    // 3. Verify active cohort enrollment for students
    if (user.role !== Role.ADMIN && user.role !== Role.INSTRUCTOR) {
      const enrollment = await prisma.enrollment.findUnique({
        where: {
          userId_cohortId: {
            userId,
            cohortId: content.folder.cohortId,
          },
        },
      });

      if (!enrollment) {
        throw forbidden("You must be enrolled in this cohort to save progress", "FORBIDDEN_NOT_ENROLLED");
      }
    }

    // 4. Sanitize and bound watched time
    const duration = content.durationSec || 0;
    const safeWatchedSeconds = duration > 0 ? Math.min(watchedSeconds, duration + 30) : watchedSeconds;

    const existingProgress = await prisma.watchProgress.findUnique({
      where: { userId_contentId: { userId, contentId } },
    });

    const currentMax = existingProgress?.maxWatchedSeconds ?? 0;
    const newMaxWatchedSeconds = Math.max(currentMax, Math.floor(safeWatchedSeconds));

    // Strict server-side completion threshold (90% of durationSec)
    const wasCompleted = existingProgress?.isCompleted ?? false;
    const meetsThreshold = duration > 0 && newMaxWatchedSeconds >= Math.floor(duration * 0.9);
    const willBeCompleted = wasCompleted || meetsThreshold;

    const completedAt = wasCompleted 
      ? existingProgress?.completedAt ?? new Date() 
      : willBeCompleted 
      ? new Date() 
      : null;

    const progress = await prisma.watchProgress.upsert({
      where: { userId_contentId: { userId, contentId } },
      update: {
        watchedSeconds: Math.floor(safeWatchedSeconds),
        maxWatchedSeconds: newMaxWatchedSeconds,
        isCompleted: willBeCompleted,
        completedAt,
      },
      create: {
        userId,
        contentId,
        watchedSeconds: Math.floor(safeWatchedSeconds),
        maxWatchedSeconds: newMaxWatchedSeconds,
        isCompleted: willBeCompleted,
        completedAt,
      },
    });

    return { status: "success", progress };
  }

  async cleanupStaleUploads() {
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    
    const staleAssets = await prisma.videoAsset.findMany({
      where: {
        status: VideoStatus.UPLOADING,
        createdAt: { lt: twentyFourHoursAgo },
      },
    });

    for (const asset of staleAssets) {
      try {
        await prisma.videoAsset.update({
          where: { id: asset.id },
          data: { status: VideoStatus.FAILED, errorMessage: "Upload abandoned or timed out." },
        });
      } catch (err) {
        console.error(`Failed to cleanup stale asset ${asset.id}:`, err);
      }
    }
  }
}