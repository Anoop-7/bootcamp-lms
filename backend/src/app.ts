import express from "express";
import cors from "cors";
import prisma from "./config/db.js";
import authRoutes from "./routes/auth.routes.js";
import cohortRoutes from "./routes/cohort.routes.js";
import contentRoutes from "./routes/content.routes.js";
import enrollmentRoutes from "./routes/enrollment.routes.js";
import progressRoutes from "./routes/progress.routes.js";
import { errorMiddleware } from "./middlewares/error.middleware.js";
import adminRouter from "./routes/admin.routes.js";

const app = express();

app.use(cors());
app.use(express.json());

// Health check verifying database connection
app.get("/health", async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.status(200).json({ status: "ok", db: "connected", timestamp: new Date().toISOString() });
  } catch (error) {
    res.status(500).json({ status: "error", db: "disconnected", error: (error as Error).message });
  }
});

// Mount modular routes
app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/cohorts", cohortRoutes);
app.use("/api/v1", contentRoutes);
app.use("/api/v1", enrollmentRoutes);
app.use("/api/v1", progressRoutes);
app.use("/api/v1/admin", adminRouter);

app.use(errorMiddleware);

export default app;