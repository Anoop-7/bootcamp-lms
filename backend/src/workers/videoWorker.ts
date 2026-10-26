import cron, { ScheduledTask } from "node-cron";
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { Readable } from "node:stream";
import { createRequire } from "node:module";
import {
  GetObjectCommand,
  PutObjectCommand,
  DeleteObjectCommand,
  AbortMultipartUploadCommand,
} from "@aws-sdk/client-s3";
import { VideoStatus } from "@prisma/client";
import prisma from "../config/db.js";
import s3Client from "../config/s3.js";
import { env } from "../config/env.js";

const require = createRequire(import.meta.url);

const BUCKET = env.AWS_S3_BUCKET;
const MAX_TRANSCODE_ATTEMPTS = 3;

function getFFmpegPath(): string {
  try {
    const installer = require("@ffmpeg-installer/ffmpeg");
    if (installer && installer.path) return installer.path;
  } catch {
    // fallback to PATH binary
  }
  return "ffmpeg";
}

function getFFprobePath(): string {
  try {
    const probeInstaller = require("@ffprobe-installer/ffprobe");
    if (probeInstaller && probeInstaller.path) return probeInstaller.path;
  } catch {
    // fallback to PATH binary
  }
  return "ffprobe";
}

// Extract exact media duration in seconds
function extractExactDurationSec(inputPath: string): Promise<number> {
  return new Promise((resolve) => {
    const ffprobeBinary = getFFprobePath();
    const args = [
      "-v", "error",
      "-show_entries", "format=duration",
      "-of", "default=noprint_wrappers=1:nokey=1",
      inputPath,
    ];

    const proc = spawn(ffprobeBinary, args);
    let output = "";

    proc.stdout.on("data", (chunk) => {
      output += chunk.toString();
    });

    proc.on("close", (code) => {
      const parsed = parseFloat(output.trim());
      if (code === 0 && !isNaN(parsed) && parsed > 0) {
        resolve(Math.round(parsed));
      } else {
        resolve(300);
      }
    });

    proc.on("error", () => resolve(300));
  });
}

async function downloadS3ToFile(key: string, targetPath: string): Promise<void> {
  const command = new GetObjectCommand({ Bucket: BUCKET, Key: key });
  const response = await s3Client.send(command);
  const stream = response.Body as Readable;

  return new Promise((resolve, reject) => {
    const writer = fs.createWriteStream(targetPath);
    stream.pipe(writer);
    writer.on("finish", resolve);
    writer.on("error", reject);
  });
}

function runFFmpegHLS(inputPath: string, outputDir: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const posterPath = path.join(outputDir, "poster.jpg");

    // Standard 2-rendition ABR (720p HD + 480p SD) for fast, stable CPU encoding
    const args = [
      "-y",
      "-i", inputPath,

      // Filter: scale to 720p and 480p maintaining aspect ratio
      "-filter_complex",
      "[0:v]split=2[v1][v2];" +
      "[v1]scale=w=-2:h=720[v1out];" +
      "[v2]scale=w=-2:h=480[v2out]",

      // Rendition 0: 720p
      "-map", "[v1out]",
      "-c:v:0", "libx264",
      "-preset", "veryfast",
      "-b:v:0", "2000k",
      "-maxrate:v:0", "2200k",
      "-bufsize:v:0", "4000k",
      "-map", "0:a:0?",
      "-c:a:0", "aac",
      "-b:a:0", "128k",

      // Rendition 1: 480p
      "-map", "[v2out]",
      "-c:v:1", "libx264",
      "-preset", "veryfast",
      "-b:v:1", "800k",
      "-maxrate:v:1", "900k",
      "-bufsize:v:1", "1600k",
      "-map", "0:a:0?",
      "-c:a:1", "aac",
      "-b:a:1", "96k",

      // Explicit Stream Mapping for HLS variant playlists
      "-var_stream_map", "v:0,a:0 v:1,a:1",

      // HLS Packaging Parameters
      "-f", "hls",
      "-hls_time", "6",
      "-hls_playlist_type", "vod",
      "-hls_flags", "independent_segments",
      "-master_pl_name", "master.m3u8",
      "-hls_segment_filename", path.join(outputDir, "v%v_chunk_%03d.ts"),
      path.join(outputDir, "v%v.m3u8"),

      // Extract single poster frame at 1s
      "-ss", "00:00:01",
      "-vframes", "1",
      posterPath,
    ];

    const ffmpegBinary = getFFmpegPath();
    console.log(`🔧 [Transcoder] Executing Multi-Bitrate HLS using: ${ffmpegBinary}`);
    const proc = spawn(ffmpegBinary, args);

    let stderrData = "";
    proc.stderr.on("data", (chunk) => {
      stderrData += chunk.toString();
    });

    proc.on("close", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`FFmpeg exited with code ${code}. Stderr snippet: ${stderrData.slice(-500)}`));
      }
    });

    proc.on("error", (err) => reject(new Error(`Failed to spawn FFmpeg: ${err.message}`)));
  });
}

async function processVideoAsset(asset: { id: string; originalKey: string; attempts: number }) {
  console.log(`🎬 [Transcoder] Started processing asset: ${asset.id} (Attempt ${asset.attempts + 1}/${MAX_TRANSCODE_ATTEMPTS})`);

  await prisma.videoAsset.update({
    where: { id: asset.id },
    data: {
      status: VideoStatus.ENCODING,
      startedAt: new Date(),
      attempts: { increment: 1 },
    },
  });

  const tempDir = path.join(os.tmpdir(), `video-${asset.id}`);
  fs.mkdirSync(tempDir, { recursive: true });

  const rawInputPath = path.join(tempDir, "input.mp4");
  const hlsOutputDir = path.join(tempDir, "hls");
  fs.mkdirSync(hlsOutputDir, { recursive: true });

  try {
    // 1. Download raw MP4 from S3
    console.log(`📥 [Transcoder] Downloading raw MP4: ${asset.originalKey}`);
    await downloadS3ToFile(asset.originalKey, rawInputPath);

    // 2. Read real duration via ffprobe
    const detectedDuration = await extractExactDurationSec(rawInputPath);
    console.log(`⏱️ [Transcoder] Detected exact duration: ${detectedDuration} seconds`);

    // 3. Multi-bitrate HLS segmentation
    console.log(`⚙️ [Transcoder] Slicing into multi-bitrate ABR HLS renditions...`);
    await runFFmpegHLS(rawInputPath, hlsOutputDir);

    // 4. Upload HLS segments, playlists, and poster to S3
    console.log(`☁️ [Transcoder] Uploading multi-bitrate chunks to S3...`);
    const files = fs.readdirSync(hlsOutputDir);
    const s3Prefix = asset.originalKey.replace(/\.[^/.]+$/, "");

    for (const file of files) {
      const filePath = path.join(hlsOutputDir, file);
      const fileBuffer = fs.readFileSync(filePath);

      let contentType = "application/octet-stream";
      let cacheControl = "public, max-age=31536000, immutable";

      if (file.endsWith(".m3u8")) {
        contentType = "application/vnd.apple.mpegurl";
        cacheControl = "no-cache";
      } else if (file.endsWith(".ts")) {
        contentType = "video/MP2T";
      } else if (file.endsWith(".jpg")) {
        contentType = "image/jpeg";
      }

      await s3Client.send(
        new PutObjectCommand({
          Bucket: BUCKET,
          Key: `${s3Prefix}/${file}`,
          Body: fileBuffer,
          ContentType: contentType,
          CacheControl: cacheControl,
        })
      );
    }

    // 5. Update DB with exact duration and master manifest
    const hlsManifestKey = `${s3Prefix}/master.m3u8`;
    const posterKey = `${s3Prefix}/poster.jpg`;

    await prisma.$transaction([
      prisma.videoAsset.update({
        where: { id: asset.id },
        data: {
          status: VideoStatus.READY,
          hlsManifestKey,
          posterKey,
          durationSec: detectedDuration,
          errorMessage: null,
        },
      }),
      prisma.content.updateMany({
        where: { videoAssetId: asset.id },
        data: { durationSec: detectedDuration },
      }),
    ]);

    console.log(`✅ [Transcoder] Asset ${asset.id} marked READY with exact duration: ${detectedDuration}s`);

    // 6. Delete raw source file from S3
    try {
      console.log(`🗑️ [Transcoder] Deleting raw input file from S3: ${asset.originalKey}`);
      await s3Client.send(
        new DeleteObjectCommand({
          Bucket: BUCKET,
          Key: asset.originalKey,
        })
      );
      console.log(`🧹 [Transcoder] Successfully removed raw file: ${asset.originalKey}`);
    } catch (cleanupS3Err) {
      console.warn(`⚠️ Failed to remove raw file ${asset.originalKey} from S3:`, cleanupS3Err);
    }
  } catch (err: any) {
    console.error(`❌ [Transcoder] Failed to process asset ${asset.id}:`, err);
    
    // Check if we should retry or fail permanently
    const currentAttempts = asset.attempts + 1;
    if (currentAttempts < MAX_TRANSCODE_ATTEMPTS) {
      console.warn(`🔁 [Transcoder] Re-queueing asset ${asset.id} for retry (${currentAttempts}/${MAX_TRANSCODE_ATTEMPTS})`);
      await prisma.videoAsset.update({
        where: { id: asset.id },
        data: {
          status: VideoStatus.QUEUED,
          errorMessage: `Attempt ${currentAttempts} failed: ${err.message || "Encoding error"}`,
        },
      });
    } else {
      await prisma.videoAsset.update({
        where: { id: asset.id },
        data: {
          status: VideoStatus.FAILED,
          errorMessage: `Exceeded max attempts (${MAX_TRANSCODE_ATTEMPTS}): ${err.message || "FFmpeg transcoding failed"}`,
        },
      });
    }
  } finally {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch (cleanupErr) {
      console.warn(`Failed to clean temp dir ${tempDir}:`, cleanupErr);
    }
  }
}

/**
 * Sweeps for stalled S3 multipart uploads older than 24 hours
 * and aborts them on S3 to prevent unbounded storage costs.
 */
async function abortStaleMultipartUploads() {
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const staleUploads = await prisma.videoAsset.findMany({
    where: {
      status: VideoStatus.UPLOADING,
      createdAt: { lt: twentyFourHoursAgo },
    },
    select: { id: true, originalKey: true, uploadId: true },
  });

  for (const asset of staleUploads) {
    if (asset.uploadId) {
      try {
        console.log(`🛑 [S3 Cleanup] Aborting abandoned multipart upload ${asset.uploadId} for key: ${asset.originalKey}`);
        await s3Client.send(
          new AbortMultipartUploadCommand({
            Bucket: BUCKET,
            Key: asset.originalKey,
            UploadId: asset.uploadId,
          })
        );
      } catch (s3Err) {
        console.warn(`⚠️ [S3 Cleanup] Failed to abort multipart upload ${asset.uploadId}:`, s3Err);
      }
    }

    await prisma.videoAsset.update({
      where: { id: asset.id },
      data: {
        status: VideoStatus.FAILED,
        errorMessage: "Upload abandoned or timed out (aborted on S3).",
      },
    });
  }
}

/**
 * Recovers jobs stuck in ENCODING or QUEUED for > 60 minutes
 * (e.g. from an ungraceful server reboot or out-of-memory crash).
 */
async function recoverStuckTranscodingJobs() {
  const sixtyMinutesAgo = new Date(Date.now() - 60 * 60 * 1000);

  const stuckAssets = await prisma.videoAsset.findMany({
    where: {
      status: { in: [VideoStatus.ENCODING, VideoStatus.QUEUED] },
      updatedAt: { lt: sixtyMinutesAgo },
    },
  });

  for (const asset of stuckAssets) {
    if (asset.attempts >= MAX_TRANSCODE_ATTEMPTS) {
      console.error(`💀 [Watchdog] Marking permanently stuck asset ${asset.id} as FAILED`);
      await prisma.videoAsset.update({
        where: { id: asset.id },
        data: {
          status: VideoStatus.FAILED,
          errorMessage: "Transcoding timed out after exceeding retry limit.",
        },
      });
    } else {
      console.warn(`🩹 [Watchdog] Recovering stuck asset ${asset.id}, resetting to QUEUED`);
      await prisma.videoAsset.update({
        where: { id: asset.id },
        data: {
          status: VideoStatus.QUEUED,
          errorMessage: `Watchdog recovered stuck transcode job (attempt ${asset.attempts + 1})`,
        },
      });
    }
  }
}

let isProcessing = false;
const scheduledTasks: ScheduledTask[] = [];

export function initVideoBackgroundWorkers() {
  // 1. Hourly cleanup of stalled S3 multipart uploads
  const cleanupTask = cron.schedule("0 * * * *", async () => {
    try {
      await abortStaleMultipartUploads();
    } catch (err) {
      console.error("Error in stale multipart upload cleanup job:", err);
    }
  });

  // 2. Watchdog every 10 minutes for stuck jobs
  const watchdogTask = cron.schedule("*/10 * * * *", async () => {
    try {
      await recoverStuckTranscodingJobs();
    } catch (err) {
      console.error("Error in stuck transcoding watchdog:", err);
    }
  });

  // 3. Queue processor every 15 seconds
  const queueTask = cron.schedule("*/15 * * * * *", async () => {
    if (isProcessing) return;

    try {
      const queuedAssets = await prisma.videoAsset.findMany({
        where: { status: VideoStatus.QUEUED },
        take: 3,
        orderBy: { createdAt: "asc" },
      });

      if (!queuedAssets || queuedAssets.length === 0) return;

      isProcessing = true;
      for (const asset of queuedAssets) {
        await processVideoAsset(asset);
      }
    } catch (err: any) {
      if (err?.code === "P1001") {
        console.warn("⚠️ [Transcoder] DB sleeping or blip, will retry next tick...");
      } else {
        console.error("Error in background transcoding worker:", err);
      }
    } finally {
      isProcessing = false;
    }
  });

  scheduledTasks.push(cleanupTask, watchdogTask, queueTask);
  console.log("🚀 Video background workers & cron schedules initialized.");
}

export function stopVideoBackgroundWorkers() {
  for (const task of scheduledTasks) {
    task.stop();
  }
  scheduledTasks.length = 0;
  console.log("🛑 Video background workers & cron schedules stopped.");
}