import rateLimit from "express-rate-limit";

// Limit upload initiation requests to prevent abuse
export const uploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // Limit each IP to 20 upload initializations per window
  message: { status: "error", message: "Too many upload requests, please try again later." },
});

// Limit playback/secure URL requests
export const playbackLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 60, // 60 requests per minute per IP
  message: { status: "error", message: "Too many playback requests." },
});