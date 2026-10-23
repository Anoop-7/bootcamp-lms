import dotenv from "dotenv";

dotenv.config();

interface AppEnv {
  NODE_ENV: "development" | "production" | "test";
  PORT: number;
  DATABASE_URL: string;
  JWT_SECRET: string;
  AWS_REGION: string;
  AWS_S3_BUCKET: string;
  AWS_ACCESS_KEY_ID?: string;
  AWS_SECRET_ACCESS_KEY?: string;
  CLOUDFRONT_DOMAIN: string;
  CLOUDFRONT_KEY_PAIR_ID?: string;
  CLOUDFRONT_PRIVATE_KEY?: string;
  FRONTEND_URL: string;
  CORS_ORIGINS: string[];
  PAYMENTS_MODE: "off" | "mock" | "razorpay";
  TRUST_PROXY: number;
  SMTP_USER?: string;
  SMTP_PASS?: string;
}

function validateEnv(): AppEnv {
  const isProd = process.env.NODE_ENV === "production";
  const missing: string[] = [];

  const requireVar = (name: string): string => {
    const val = process.env[name];
    if (!val || val.trim() === "") {
      missing.push(name);
      return "";
    }
    return val.trim();
  };

  const NODE_ENV = (process.env.NODE_ENV as "development" | "production" | "test") || "development";
  const PORT = Number(process.env.PORT) || 5000;
  const DATABASE_URL = requireVar("DATABASE_URL");
  const JWT_SECRET = requireVar("JWT_SECRET");

  if (JWT_SECRET && JWT_SECRET.length < 32 && isProd) {
    console.error("❌ [SECURITY FATAL] JWT_SECRET must be at least 32 characters long in production.");
    process.exit(1);
  }

  const AWS_REGION = requireVar("AWS_REGION");
  const AWS_S3_BUCKET = requireVar("AWS_S3_BUCKET");
  const CLOUDFRONT_DOMAIN = requireVar("CLOUDFRONT_DOMAIN");

  const FRONTEND_URL =
    process.env.FRONTEND_URL?.trim() || (!isProd ? "http://localhost:5173" : requireVar("FRONTEND_URL"));

  // Default to "off" so missing settings never default to granting free access
  const rawPayments = process.env.PAYMENTS_MODE?.trim().toLowerCase();
  const PAYMENTS_MODE: "off" | "mock" | "razorpay" =
    rawPayments === "razorpay" ? "razorpay" : rawPayments === "mock" ? "mock" : "off";

  if (isProd && PAYMENTS_MODE === "mock") {
    console.error("❌ [SECURITY FATAL] PAYMENTS_MODE cannot be set to 'mock' in production.");
    process.exit(1);
  }

  if (missing.length > 0) {
    console.error(`❌ [STARTUP FATAL] Missing required environment variables:\n   - ${missing.join("\n   - ")}`);
    process.exit(1);
  }

  const rawCors = process.env.CORS_ORIGINS || FRONTEND_URL || "http://localhost:5173";
  const CORS_ORIGINS = rawCors.split(",").map((s) => s.trim().replace(/\/$/, ""));

  return {
    NODE_ENV,
    PORT,
    DATABASE_URL,
    JWT_SECRET,
    AWS_REGION,
    AWS_S3_BUCKET,
    AWS_ACCESS_KEY_ID: process.env.AWS_ACCESS_KEY_ID,
    AWS_SECRET_ACCESS_KEY: process.env.AWS_SECRET_ACCESS_KEY,
    CLOUDFRONT_DOMAIN,
    CLOUDFRONT_KEY_PAIR_ID: process.env.CLOUDFRONT_KEY_PAIR_ID,
    CLOUDFRONT_PRIVATE_KEY: process.env.CLOUDFRONT_PRIVATE_KEY,
    FRONTEND_URL,
    CORS_ORIGINS,
    PAYMENTS_MODE,
    TRUST_PROXY: Number(process.env.TRUST_PROXY ?? 0),
    SMTP_USER: process.env.SMTP_USER,
    SMTP_PASS: process.env.SMTP_PASS,
  };
}

export const env = validateEnv();