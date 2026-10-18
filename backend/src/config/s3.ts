import { 
  S3Client, 
  GetObjectCommand, 
  PutObjectCommand,
  CreateMultipartUploadCommand,
  UploadPartCommand,
  CompleteMultipartUploadCommand,
  AbortMultipartUploadCommand
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import "dotenv/config";

const s3Client = new S3Client({
  region: process.env.AWS_REGION || "ap-south-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || "mock-key",
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "mock-secret",
  },
});

export const generateUploadPresignedUrl = async (
  filename: string,
  contentType: string
): Promise<{ uploadUrl: string; key: string }> => {
  const sanitizedOriginalName = filename
    .replace(/[^a-zA-Z0-9.-]/g, "_")
    .toLowerCase();
  
  const key = `videos/${Date.now()}-${sanitizedOriginalName}`;

  const command = new PutObjectCommand({
    Bucket: process.env.AWS_S3_BUCKET,
    Key: key,
    ContentType: contentType,
  });

  const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn: 900 });

  return { uploadUrl, key };
};

// --- Multipart Upload Helpers for Large Videos ---

export const initiateMultipartUpload = async (
  filename: string,
  contentType: string
): Promise<{ uploadId: string; key: string }> => {
  const sanitizedOriginalName = filename
    .replace(/[^a-zA-Z0-9.-]/g, "_")
    .toLowerCase();
  const key = `videos/${Date.now()}-${sanitizedOriginalName}`;

  const command = new CreateMultipartUploadCommand({
    Bucket: process.env.AWS_S3_BUCKET,
    Key: key,
    ContentType: contentType,
  });

  const response = await s3Client.send(command);
  if (!response.UploadId) {
    throw new Error("FAILED_TO_INITIATE_MULTIPART_UPLOAD");
  }

  return { uploadId: response.UploadId, key };
};

export const getPresignedPartUrl = async (
  key: string,
  uploadId: string,
  partNumber: number
): Promise<string> => {
  const command = new UploadPartCommand({
    Bucket: process.env.AWS_S3_BUCKET,
    Key: key,
    UploadId: uploadId,
    PartNumber: partNumber,
  });

  return getSignedUrl(s3Client, command, { expiresIn: 900 });
};

export const completeMultipartUpload = async (
  key: string,
  uploadId: string,
  parts: { ETag: string; PartNumber: number }[]
): Promise<void> => {
  const command = new CompleteMultipartUploadCommand({
    Bucket: process.env.AWS_S3_BUCKET,
    Key: key,
    UploadId: uploadId,
    MultipartUpload: {
      Parts: parts.sort((a, b) => a.PartNumber - b.PartNumber),
    },
  });

  await s3Client.send(command);
};

export const abortMultipartUpload = async (
  key: string,
  uploadId: string
): Promise<void> => {
  const command = new AbortMultipartUploadCommand({
    Bucket: process.env.AWS_S3_BUCKET,
    Key: key,
    UploadId: uploadId,
  });

  await s3Client.send(command);
};

export const getPresignedDownloadUrl = async (
  bucket: string,
  key: string,
  expiresInSeconds: number = 900
): Promise<string> => {
  const command = new GetObjectCommand({
    Bucket: bucket,
    Key: key,
  });

  return getSignedUrl(s3Client, command, { expiresIn: expiresInSeconds });
};

export default s3Client;