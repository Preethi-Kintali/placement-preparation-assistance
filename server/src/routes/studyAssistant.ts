import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth";
import { buildStudentRagDocs, retrieveTopDocs } from "../services/studyRag";
import { studyChatCompletion } from "../services/studyProviders";
import { StudySession } from "../models/StudySession";

const router = Router();

router.get("/health", (_req, res) => {
  res.json({ ok: true, service: "study-assistant" });
});

router.get("/context", requireAuth, async (req, res) => {
  const userId = req.user!.userId;
  const { facts, docs } = await buildStudentRagDocs(userId);
  return res.json({ facts, docs: docs.map((d) => ({ id: d.id, title: d.title })) });
});

router.get("/sessions", requireAuth, async (req, res) => {
  const limit = z.coerce.number().int().min(1).max(50).default(10).parse(req.query.limit ?? 10);
  const userId = req.user!.userId;
  const sessions = await StudySession.find({ userId }).sort({ createdAt: -1 }).limit(limit).lean();
  return res.json({ sessions });
});

const ChatSchema = z.object({
  message: z.string().min(1).max(4000),
  history: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().min(1).max(4000),
      })
    )
    .max(20)
    .optional(),
  provider: z.enum(["groq", "gemini"]).optional(),
});

router.post("/chat", requireAuth, async (req, res) => {
  const parsed = ChatSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid payload", details: parsed.error.flatten() });
  }

  try {
    const hasGroq = Boolean(process.env.STUDY_GROQ_API_KEY || process.env.INTERVIEW_GROQ_API_KEY);
    const hasGemini = Boolean(process.env.STUDY_GEMINI_API_KEY || process.env.INTERVIEW_GEMINI_API_KEY);
    if (!hasGroq && !hasGemini) {
      return res.status(500).json({
        error: "Study Assistant is not configured",
        details:
          "Set STUDY_GROQ_API_KEY/STUDY_GEMINI_API_KEY (preferred) or INTERVIEW_GROQ_API_KEY/INTERVIEW_GEMINI_API_KEY in server env",
      });
    }

    const requestedProvider = parsed.data.provider ?? "groq";
    const provider =
      requestedProvider === "groq"
        ? hasGroq
          ? "groq"
          : "gemini"
        : hasGemini
          ? "gemini"
          : "groq";

    const userId = req.user!.userId;
    const { facts, docs } = await buildStudentRagDocs(userId);
    const top = retrieveTopDocs({ docs, query: parsed.data.message, k: 5 });

    const contextBlock = top
      .map((d) => `### ${d.title}\n[doc:${d.id}]\n${d.text}`)
      .join("\n\n");

    const system = [
      "You are PlacePrep AI Study Assistant.",
      "Your job: help the student decide what to study today and what to do next.",
      "Use the provided STUDENT CONTEXT only; do not invent progress/scores.",
      "Output format (exact):",
      "1) Today (30-90 min): 3 bullets",
      "2) Next (this week): 3 bullets",
      "3) Why: 2 bullets referencing doc ids like [doc:roadmap-week]",
      "If the user asks for a plan, include steps and time estimates.",
      "If context is missing, ask 1-2 clarifying questions.",
      "",
      "STUDENT FACTS (JSON):",
      JSON.stringify(facts),
      "",
      "STUDENT CONTEXT DOCUMENTS:",
      contextBlock || "(no docs)",
    ].join("\n");

    const history = parsed.data.history ?? [];

    const answer = await studyChatCompletion({
      provider,
      system,
      messages: [...history, { role: "user", content: parsed.data.message }],
      temperature: 0.2,
    });

    const citations = top.map((d) => ({ id: d.id, title: d.title }));
    await StudySession.create({
      userId,
      provider,
      prompt: parsed.data.message,
      answer,
      citations,
    });

    return res.json({
      answer,
      citations,
      provider,
    });
  } catch (e: any) {
    // eslint-disable-next-line no-console
    console.error("Study Assistant error:", e);
    return res.status(502).json({ error: "Study Assistant provider error", details: String(e?.message ?? e) });
  }
});

export default router;
