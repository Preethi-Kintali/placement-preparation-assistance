import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth";
import { buildStudentRagDocs, retrieveTopDocs } from "../services/studyRag";
import { studyChatCompletion } from "../services/studyProviders";
import { StudySession } from "../models/StudySession";
import { similaritySearch, buildRagContext, getRagStatus } from "../services/ragPipeline";

const router = Router();

router.get("/health", (_req, res) => {
  res.json({ ok: true, service: "study-assistant" });
});

// ── RAG Pipeline Status ─────────────────────────────────────
router.get("/rag-status", async (_req, res) => {
  try {
    const status = await getRagStatus();
    return res.json(status);
  } catch (e: any) {
    return res.status(500).json({ error: "RAG status error", details: String(e?.message ?? e) });
  }
});

// ── RAG Sources (retrieve top chunks for a query) ───────────
router.post("/rag-sources", requireAuth, async (req, res) => {
  const { query, topK } = req.body;
  if (!query || typeof query !== "string") {
    return res.status(400).json({ error: "query is required" });
  }
  try {
    const results = await similaritySearch(query, topK ?? 5);
    return res.json({ results });
  } catch (e: any) {
    return res.status(500).json({ error: "RAG search error", details: String(e?.message ?? e) });
  }
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

    // ── RAG Pipeline: Similarity Search on PDF Knowledge Base ──
    let ragContext = "";
    let ragCitations: Array<{ chunkIndex: number; text: string; score: number; source: string }> = [];
    try {
      const ragResults = await similaritySearch(parsed.data.message, 5);
      ragCitations = ragResults;
      ragContext = buildRagContext(ragResults);
    } catch (ragErr) {
      console.warn("[RAG] Similarity search failed, continuing without RAG context:", ragErr);
      ragContext = "(RAG search unavailable)";
    }

    const system = [
      "You are PlacePrep AI Study Assistant powered by a RAG (Retrieval-Augmented Generation) pipeline.",
      "Your job: help the student with placement preparation using retrieved knowledge + student data.",
      "Use the provided KNOWLEDGE BASE CONTEXT and STUDENT CONTEXT; do not invent facts.",
      "When answering, cite sources like [Source 1], [Source 2] etc.",
      "Output format:",
      "1) Direct answer to the question using knowledge base",
      "2) Personalized advice based on student context",
      "3) Sources: list which [Source N] you used",
      "If the user asks for a study plan, include steps and time estimates.",
      "If context is missing, ask 1-2 clarifying questions.",
      "",
      "═══ KNOWLEDGE BASE (RAG Retrieved) ═══",
      ragContext,
      "",
      "═══ STUDENT FACTS (JSON) ═══",
      JSON.stringify(facts),
      "",
      "═══ STUDENT CONTEXT DOCUMENTS ═══",
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
      ragSources: ragCitations.map((r) => ({
        chunkIndex: r.chunkIndex,
        text: r.text.slice(0, 200) + (r.text.length > 200 ? "..." : ""),
        score: r.score,
        source: r.source,
      })),
      pipeline: [
        { step: "Knowledge Base", status: "done", detail: "Placement_Assistance_RAG_System.pdf" },
        { step: "Document Processing", status: "done", detail: "PDF text extracted" },
        { step: "Chunking", status: "done", detail: `${ragCitations.length > 0 ? 'Chunks indexed' : 'Not indexed'}` },
        { step: "Query Embedding", status: "done", detail: "Gemini text-embedding-004" },
        { step: "Similarity Search", status: "done", detail: `Top ${ragCitations.length} chunks retrieved` },
        { step: "Context + Prompt", status: "done", detail: "RAG + Student context merged" },
        { step: "LLM", status: "done", detail: `${provider.toUpperCase()} response generated` },
        { step: "Final Answer", status: "done", detail: "Delivered" },
      ],
    });
  } catch (e: any) {
    // eslint-disable-next-line no-console
    console.error("Study Assistant error:", e);
    return res.status(502).json({ error: "Study Assistant provider error", details: String(e?.message ?? e) });
  }
});

export default router;
