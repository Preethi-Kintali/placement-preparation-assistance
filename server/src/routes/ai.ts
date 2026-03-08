import { Router } from "express";
import { z } from "zod";

import { requireAuth } from "../middleware/auth";
import { groqChat } from "../services/groq";
import { geminiChat } from "../services/gemini";
import { youtubeSearch } from "../services/youtube";
import { HttpError } from "../services/http";
import studyAssistantRouter from "./studyAssistant";

export const aiRouter = Router();

aiRouter.use("/study", studyAssistantRouter);

const chatSchema = z.object({
  provider: z.enum(["groq", "gemini"]).default("groq"),
  message: z.string().min(1).max(10_000),
});

aiRouter.post("/chat", requireAuth, async (req, res) => {
  const parsed = chatSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const { provider, message } = parsed.data;

  try {
    let reply: string;
    let actualProvider = provider;

    if (provider === "gemini") {
      try {
        reply = await geminiChat(message);
      } catch (geminiErr: any) {
        const msg = String(geminiErr?.message || "");
        // On rate limit / quota errors → fall back to Groq
        if (msg.includes("429") || msg.includes("quota") || msg.includes("RESOURCE_EXHAUSTED") || msg.includes("rate")) {
          console.warn("[AI Chat] Gemini rate-limited, falling back to Groq");
          reply = await groqChat(message);
          actualProvider = "groq";
        } else {
          throw geminiErr;
        }
      }
    } else {
      reply = await groqChat(message);
    }

    return res.json({ provider: actualProvider, reply });
  } catch (e: any) {
    if (e instanceof HttpError) {
      return res.status(502).json({ error: "AI provider error", upstreamStatus: e.status, upstreamBody: e.body });
    }
    return res.status(502).json({ error: "AI provider error", details: String(e?.message ?? e) });
  }
});

aiRouter.get("/youtube/search", requireAuth, async (req, res) => {
  const q = z.object({ query: z.string().min(1), maxResults: z.coerce.number().int().min(1).max(10).default(1) }).safeParse(req.query);
  if (!q.success) return res.status(400).json({ error: q.error.flatten() });

  try {
    const { videos, source } = await youtubeSearch(q.data.query, q.data.maxResults);
    return res.json({ query: q.data.query, items: videos, source });
  } catch (e: any) {
    if (e instanceof HttpError) {
      return res.status(502).json({ error: "YouTube API error", upstreamStatus: e.status, upstreamBody: e.body });
    }
    return res.status(502).json({ error: "YouTube API error", details: String(e?.message ?? e) });
  }
});
