import "dotenv/config";
import app from "./app.js";
import { initVideoBackgroundWorkers } from "./workers/videoWorker.js";

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);

  // Initialize background cron jobs and transcoding workers
  initVideoBackgroundWorkers();
});