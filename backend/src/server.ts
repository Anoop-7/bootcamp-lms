import "dotenv/config";
import app from "./app.js";
import prisma from "./config/db.js";
import { initVideoBackgroundWorkers, stopVideoBackgroundWorkers } from "./workers/videoWorker.js";

const PORT = process.env.PORT || 5000;

const server = app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);

  // Initialize background cron jobs and transcoding workers
  initVideoBackgroundWorkers();
});

// Graceful shutdown hooks
const shutdown = async (signal: string) => {
  console.log(`\n🛑 Received ${signal}. Initiating graceful shutdown...`);

  // Stop background cron jobs
  stopVideoBackgroundWorkers();

  // Close HTTP server to stop accepting new requests
  server.close(async () => {
    console.log("🔒 HTTP server closed.");
    try {
      await prisma.$disconnect();
      console.log("📦 Database connection closed.");
      process.exit(0);
    } catch (err) {
      console.error("Error during database disconnection:", err);
      process.exit(1);
    }
  });

  // Force shutdown if cleanup hangs
  setTimeout(() => {
    console.error("⚠️ Graceful shutdown timed out. Forcing process exit.");
    process.exit(1);
  }, 10000).unref();
};

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));