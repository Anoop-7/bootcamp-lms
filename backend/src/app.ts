import express from "express";
import cors from "cors";
import helmet from "helmet";
import prisma from "./config/db.js";
import { env } from "./config/env.js";
import authRoutes from "./routes/auth.routes.js";
import cohortRoutes from "./routes/cohort.routes.js";
import contentRoutes from "./routes/content.routes.js";
import enrollmentRoutes from "./routes/enrollment.routes.js";
import progressRoutes from "./routes/progress.routes.js";
import adminRouter from "./routes/admin.routes.js";
import { errorHandler } from "./middlewares/error.middleware.js";

const app = express();

// Trust reverse proxy (e.g. Render, AWS ALB, Nginx, Cloudflare)
app.set("trust proxy", env.TRUST_PROXY);

// Security Headers
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
}));

// CORS Configuration strictly bound to validated origins
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps, curl, server-to-server)
      if (!origin) return callback(null, true);
      if (env.CORS_ORIGINS.includes(origin) || env.NODE_ENV === "development") {
        return callback(null, true);
      }
      return callback(new Error("CORS policy violation: origin not allowed."));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

app.use(express.json());

// Health check verifying database connection (L8: never leak raw DB errors)
app.get("/health", async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.status(200).json({ status: "ok", db: "connected", timestamp: new Date().toISOString() });
  } catch (error) {
    console.error("❌ [HEALTH CHECK DATABASE FAILURE]:", error);
    res.status(503).json({ status: "error", db: "disconnected" });
  }
});

// Mount modular routes
app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/cohorts", cohortRoutes);
app.use("/api/v1", contentRoutes);
app.use("/api/v1", enrollmentRoutes);
app.use("/api/v1", progressRoutes);
app.use("/api/v1/admin", adminRouter);

app.use(errorHandler);

export default app;