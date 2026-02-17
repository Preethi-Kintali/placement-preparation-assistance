import express from "express";
import cors from "cors";
import morgan from "morgan";

import { clientOrigins, env } from "./config/env";
import { connectDb } from "./config/db";
import { apiRouter } from "./routes";

async function main() {
  await connectDb();

  const app = express();
  app.use(morgan("dev"));
  app.use(
    cors({
      origin: (origin, callback) => {
        if (!origin) return callback(null, true);
        if (env.NODE_ENV === "development") {
          // Dev UX: allow Vite on any localhost port.
          if (/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin)) {
            return callback(null, true);
          }
        }
        if (clientOrigins.includes(origin)) return callback(null, true);
        return callback(new Error("Not allowed by CORS"));
      },
      credentials: true,
    })
  );
  // Allow lightweight base64 avatars in profile updates.
  // Note: base64 expands size ~33%, so keep this a bit higher than the client file cap.
  app.use(express.json({ limit: "4mb" }));

  app.get("/health", (_req, res) => {
    res.json({ ok: true, env: env.NODE_ENV });
  });

  app.use("/api", apiRouter);

  app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    // Body-parser / express.json oversized payload
    const anyErr = err as any;
    if (anyErr?.type === "entity.too.large" || anyErr?.status === 413) {
      return res.status(413).json({ error: "Payload too large. Please use a smaller image (under 1MB)." });
    }

    // eslint-disable-next-line no-console
    console.error(err);
    return res.status(500).json({ error: "Internal Server Error" });
  });

  app.listen(env.PORT, () => {
    // eslint-disable-next-line no-console
    console.log(`Server listening on http://localhost:${env.PORT}`);
  });
}

main().catch((e) => {
  // eslint-disable-next-line no-console
  console.error("Fatal:", e);
  process.exit(1);
});
