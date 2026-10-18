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

const contentRepository = new ContentRepository();

export class ContentService {
  async addFolder(data: { title: string; cohortId: string; order?: number }) {
    return contentRepository.createFolder(data);
  }

  async updateFolder(folderId: string, title: string) {
    return prisma.folder.update({
      where: { id: folderId },
      data: { title: title.trim() },
    });
  }

  async deleteFolder(folderId: string) {
    return prisma.folder.delete({
      where: { id: folderId },
    });
  }

  async addContent(data: {
    title: string;
    type: ContentType;
    folderId: string;
    videoAssetId?: string;
    resourceDoc?: string;
    durationSec?: number;
    order?: number;
  }) {
    return contentRepository.createContent(data);
  }

  async deleteContent(contentId: string) {
    return prisma.content.delete({
      where: { id: contentId },
    });
  }

  // --- Multipart Upload Pipeline ---

  async initiateUpload(filename: string, contentType: string) {
    const allowedTypes = ["video/mp4", "video/quicktime", "video/x-matroska", "video/webm", "video/x-m4v"];
    if (contentType && !allowedTypes.includes(contentType)) {
      throw new Error("UNSUPPORTED_VIDEO_FORMAT");
    }

    const { uploadId, key } = await initiateMultipartUpload(filename, contentType);
    
    const videoAsset = await prisma.videoAsset.create({
      data: {
        originalKey: key,
        status: VideoStatus.UPLOADING,
      },
    });

    return { uploadId, key, videoAssetId: videoAsset.id };
  }

  async getPartUrl(key: string, uploadId: string, partNumber: number) {
    const presignedUrl = await getPresignedPartUrl(key, uploadId, partNumber);
    return { presignedUrl };
  }

  async completeUpload(key: string, uploadId: string, parts: { ETag: string; PartNumber: number }[], videoAssetId?: string) {
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
      throw new Error("CONTENT_NOT_FOUND");
    }

    if (content.videoAsset && content.videoAsset.status !== VideoStatus.READY) {
      throw new Error("VIDEO_STILL_PROCESSING");
    }

    const cohortId = content.folder.cohortId;

    if (userRole !== Role.ADMIN && userRole !== Role.INSTRUCTOR) {
      const enrollment = await prisma.enrollment.findUnique({
        where: { userId_cohortId: { userId, cohortId } },
      });

      if (!enrollment) {
        throw new Error("NOT_ENROLLED");
      }
    }

    // Single-device session enforcement
    const sessionToken = crypto.randomBytes(32).toString("hex");
    await prisma.user.update({
      where: { id: userId },
      data: { activeSessionToken: sessionToken },
    });

    const assetKey = content.videoAsset?.hlsManifestKey || content.videoAsset?.originalKey || content.resourceDoc;
    if (!assetKey) {
      throw new Error("NO_ASSET_ATTACHED");
    }

    if (assetKey.startsWith("http://") || assetKey.startsWith("https://")) {
      return { url: assetKey, isDirect: true, sessionToken };
    }

    // Serve HLS streaming files through CloudFront
    const cloudfrontBase = process.env.CLOUDFRONT_DOMAIN || "";
    if (cloudfrontBase && assetKey.endsWith(".m3u8")) {
      const cleanDomain = cloudfrontBase.replace(/\/$/, "");
      const cleanKey = assetKey.replace(/^\//, "");
      const cdnUrl = `${cleanDomain}/${cleanKey}`;
      return { url: cdnUrl, isDirect: false, sessionToken };
    }

    // S3 presigned URL fallback
    const bucket = process.env.AWS_S3_BUCKET || "bootcamp-lms-assets-anoop";
    const presignedUrl = await getPresignedDownloadUrl(bucket, assetKey, 3600);

    return { url: presignedUrl, isDirect: false, sessionToken };
  }

  // --- Heartbeat & Progress ---

  async processHeartbeat(userId: string, contentId: string, watchedSeconds: number, sessionToken: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { activeSessionToken: true },
    });

    if (!user || user.activeSessionToken !== sessionToken) {
      throw new Error("SESSION_EXPIRED_OR_REPLACED");
    }

    const content = await prisma.content.findUnique({
      where: { id: contentId },
      select: { durationSec: true },
    });

    const duration = content?.durationSec || 1;
    const progressRatio = watchedSeconds / duration;
    const isCompleted = progressRatio >= 0.9;

    const progress = await prisma.watchProgress.upsert({
      where: { userId_contentId: { userId, contentId } },
      update: {
        watchedSeconds: Math.max(watchedSeconds, 0),
        isCompleted: isCompleted ? true : undefined,
        completedAt: isCompleted ? new Date() : undefined,
      },
      create: {
        userId,
        contentId,
        watchedSeconds: Math.max(watchedSeconds, 0),
        isCompleted,
        completedAt: isCompleted ? new Date() : null,
      },
    });

    return { status: "success", progress };
  }

  // Cleanup abandoned uploads (> 24 hours old)
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