import express from "express";
import cors from "cors";
import morgan from "morgan";

import { env } from "./config/env";
import { connectDb } from "./config/db";
import { apiRouter } from "./routes";
import { initJobEmailCron } from "./services/jobEmailCron";

const app = express();

app.use(morgan("dev"));

// ✅ Allow all origins (for mobile APK + Vercel frontend)
app.use(cors());

// Allow JSON body up to 4mb
app.use(express.json({ limit: "4mb" }));

// Health route (works even before DB connects)
app.get("/health", (_req, res) => {
  res.json({ ok: true, env: env.NODE_ENV });
});

// API routes
app.use("/api", apiRouter);

// Global error handler
app.use(
  (
    err: unknown,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction
  ) => {
    const anyErr = err as any;

    if (anyErr?.type === "entity.too.large" || anyErr?.status === 413) {
      return res
        .status(413)
        .json({ error: "Payload too large. Please use a smaller image." });
    }

    console.error(err);
    return res.status(500).json({ error: "Internal Server Error" });
  }
);

// ✅ BIND PORT FIRST so Render detects it immediately
const PORT = env.PORT || 4000;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server listening on port ${PORT}`);

  // Connect DB and init cron AFTER port is open (non-blocking for Render)
  connectDb()
    .then(() => {
      console.log("✅ Database connected");
      initJobEmailCron();
    })
    .catch((e) => {
      console.error("❌ Database connection failed:", e);
      process.exit(1);
    });
});