import { api } from "../lib/api";
import axios from "axios";

export async function uploadLargeVideoFile(
  file: File,
  onProgress?: (progress: number) => void
): Promise<{ key: string; videoAssetId: string }> {
  const filename = file.name;
  const contentType = file.type || "video/mp4";

  // 1. Initiate Multipart Upload on Backend (creates VideoAsset in DB)
  const initRes = await api.post("/contents/multipart/initiate", {
    filename,
    contentType,
  });
  const { uploadId, key, videoAssetId } = initRes.data.data;

  const CHUNK_SIZE = 10 * 1024 * 1024; // 10MB chunks
  const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
  const parts: { ETag: string; PartNumber: number }[] = [];
  let uploadedBytes = 0;

  // 2. Upload chunks sequentially
  for (let partNumber = 1; partNumber <= totalChunks; partNumber++) {
    const start = (partNumber - 1) * CHUNK_SIZE;
    const end = Math.min(start + CHUNK_SIZE, file.size);
    const chunk = file.slice(start, end);

    // Get presigned URL for this specific part
    const signRes = await api.post("/contents/multipart/sign-part", {
      key,
      uploadId,
      partNumber,
    });
    const { presignedUrl } = signRes.data.data;

    // Upload chunk directly to S3 (bypassing auth headers for S3)
    const uploadRes = await axios.put(presignedUrl, chunk, {
      headers: { "Content-Type": contentType },
    });

    const etag = uploadRes.headers["etag"] || uploadRes.headers["ETag"];
    if (!etag) {
      throw new Error(`Failed to retrieve ETag for part ${partNumber}`);
    }

    parts.push({
      ETag: etag.replace(/"/g, ""), // S3 ETags are wrapped in quotes
      PartNumber: partNumber,
    });

    uploadedBytes += chunk.size;
    if (onProgress) {
      onProgress(Math.round((uploadedBytes / file.size) * 100));
    }
  }

  // 3. Complete Multipart Upload
  await api.post("/contents/multipart/complete", {
    key,
    uploadId,
    parts,
    videoAssetId,
  });

  return { key, videoAssetId };
}