import rateLimit, { ipKeyGenerator } from "express-rate-limit";

// 1. Login Limiter: 10 attempts per 15 minutes per IP + email key
export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  validate: { keyGeneratorIpFallback: false },
  keyGenerator: (req) => {
    const email = req.body?.email?.trim().toLowerCase() || "anonymous";
    const clientIp = ipKeyGenerator(req.ip || "127.0.0.1");
    return `${clientIp}-${email}`;
  },
  message: {
    status: "error",
    message: "Too many login attempts. Please try again after 15 minutes.",
  },
});

// 2. Register Limiter: 5 account creations per hour per IP
export const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    status: "error",
    message: "Too many registration attempts from this IP. Please try again in an hour.",
  },
});

// 3. Forgot Password Request Limiter: 10 per hour per IP
export const forgotPasswordLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    status: "error",
    message: "Too many password reset requests. Please try again later.",
  },
});

// 4. Reset Password OTP Attempt Limiter: 10 attempts per 15 minutes per IP
export const resetPasswordLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    status: "error",
    message: "Too many verification attempts. Please request a new code.",
  },
});

// 5. Invite Token Inspection & Acceptance Limiter: 15 requests per 15 minutes
export const inviteLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 15,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    status: "error",
    message: "Too many requests to onboarding invites. Please wait a moment.",
  },
});

// 6. Upload Limiter: 20 initializations per 15 minutes
export const uploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { status: "error", message: "Too many upload requests, please try again later." },
});

// 7. Playback Limiter: 60 requests per minute
export const playbackLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { status: "error", message: "Too many playback requests." },
});