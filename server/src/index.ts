import express from "express";
import cors from "cors";
import morgan from "morgan";

import { env } from "./config/env";
import { connectDb } from "./config/db";
import { apiRouter } from "./routes";
import { initJobEmailCron } from "./services/jobEmailCron";

async function main() {
  await connectDb();

  // Start daily job email cron
  initJobEmailCron();

  const app = express();

  app.use(morgan("dev"));

  // ✅ Allow all origins (for testing with mobile APK)
  app.use(cors());

  // Allow JSON body up to 4mb
  app.use(express.json({ limit: "4mb" }));

  // Health route
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

  // ✅ IMPORTANT: Bind to 0.0.0.0 for mobile access
  app.listen(env.PORT || 4000, "0.0.0.0", () => {
    console.log(`Server running on port ${env.PORT || 4000}`);
  });
}

main().catch((e) => {
  console.error("Fatal:", e);
  process.exit(1);
});