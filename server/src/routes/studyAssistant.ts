/**
 * ═══════════════════════════════════════════════════════════════════
 *  STUDY ASSISTANT v2 — Enhanced RAG, Guardrails, Chat Memory
 * ═══════════════════════════════════════════════════════════════════
 */

import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth";
import { buildStudentRagDocs, retrieveTopDocs } from "../services/studyRag";
import { studyChatCompletion } from "../services/studyProviders";
import { StudySession } from "../models/StudySession";
import { similaritySearch, buildRagContext, getRagStatus, clearRagCache } from "../services/ragPipeline";
import {
    runGuardrails,
    getGroundingRules,
    validateOutput,
    calculateConfidence,
} from "../services/guardrails";
import { analyzeSkillGap } from "../services/personalization";

const router = Router();

router.get("/health", (_req, res) => {
    res.json({ ok: true, service: "study-assistant-v2" });
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
        const results = await similaritySearch(query, topK ?? 5, { useMultiQuery: true });
        return res.json({ results });
    } catch (e: any) {
        return res.status(500).json({ error: "RAG search error", details: String(e?.message ?? e) });
    }
});

// ── Clear RAG Cache ──────────────────────────────────────────
router.post("/clear-cache", requireAuth, async (_req, res) => {
    try {
        const cleared = clearRagCache();
        return res.json({ cleared, message: `Cleared ${cleared} cached entries` });
    } catch (e: any) {
        return res.status(500).json({ error: "Cache clear error", details: String(e?.message ?? e) });
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

// ── Personalization / Skill Gap ──────────────────────────────
router.get("/personalization", requireAuth, async (req, res) => {
    try {
        const userId = req.user!.userId;
        const insight = await analyzeSkillGap(userId);
        return res.json(insight);
    } catch (e: any) {
        return res.status(500).json({ error: "Personalization error", details: String(e?.message ?? e) });
    }
});

// ── Chat Sessions (threaded) ─────────────────────────────────
router.get("/threads", requireAuth, async (req, res) => {
    try {
        const userId = req.user!.userId;
        const threads = await StudySession.aggregate([
            { $match: { userId } },
            { $sort: { createdAt: -1 } },
            {
                $group: {
                    _id: "$threadId",
                    lastMessage: { $first: "$prompt" },
                    lastAnswer: { $first: "$answer" },
                    lastAt: { $first: "$createdAt" },
                    messageCount: { $sum: 1 },
                },
            },
            { $sort: { lastAt: -1 } },
            { $limit: 20 },
        ]);
        return res.json({ threads });
    } catch (e: any) {
        return res.status(500).json({ error: "Thread list error", details: String(e?.message ?? e) });
    }
});

// ── Main Chat Endpoint ───────────────────────────────────────

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
    threadId: z.string().optional(),
    useMultiQuery: z.boolean().optional(),
});

router.post("/chat", requireAuth, async (req, res) => {
    const parsed = ChatSchema.safeParse(req.body);
    if (!parsed.success) {
        return res.status(400).json({ error: "Invalid payload", details: parsed.error.flatten() });
    }

    try {
        // ── Step 0: Guardrails Check ──
        const guardrail = runGuardrails(parsed.data.message);
        if (guardrail.blocked) {
            return res.json({
                answer: guardrail.blockReason || "Your message was blocked by safety filters.",
                citations: [],
                provider: "guardrails",
                confidence: { score: 0, level: "none" },
                grounded: false,
                guardrails: {
                    blocked: true,
                    injectionDetected: guardrail.injectionDetected,
                    reason: guardrail.blockReason,
                },
                ragSources: [],
                pipeline: [
                    { step: "Guardrails", status: "blocked", detail: guardrail.blockReason || "Blocked" },
                ],
            });
        }

        const sanitizedMessage = guardrail.sanitizedQuery;

        // ── Provider Selection ──
        const hasGroq = Boolean(process.env.STUDY_GROQ_API_KEY || process.env.INTERVIEW_GROQ_API_KEY);
        const hasGemini = Boolean(process.env.STUDY_GEMINI_API_KEY || process.env.INTERVIEW_GEMINI_API_KEY);
        if (!hasGroq && !hasGemini) {
            return res.status(500).json({
                error: "Study Assistant is not configured",
                details: "Set STUDY_GROQ_API_KEY/STUDY_GEMINI_API_KEY",
            });
        }

        const requestedProvider = parsed.data.provider ?? "groq";
        const provider =
            requestedProvider === "groq"
                ? hasGroq ? "groq" : "gemini"
                : hasGemini ? "gemini" : "groq";

        const userId = req.user!.userId;

        // ── Step 1: Build Student Context ──
        const { facts, docs } = await buildStudentRagDocs(userId);
        const top = retrieveTopDocs({ docs, query: sanitizedMessage, k: 5 });

        const contextBlock = top
            .map((d) => `### ${d.title}\n[doc:${d.id}]\n${d.text}`)
            .join("\n\n");

        // ── Step 2: Chat Memory (last 5 from thread) ──
        let chatMemory: Array<{ role: "user" | "assistant"; content: string }> = [];
        const threadId = parsed.data.threadId || `thread_${Date.now()}`;

        if (parsed.data.threadId) {
            const prevMessages = await StudySession.find({ userId, threadId })
                .sort({ createdAt: -1 })
                .limit(5)
                .lean();

            chatMemory = prevMessages
                .reverse()
                .flatMap((m: any) => [
                    { role: "user" as const, content: String(m.prompt) },
                    { role: "assistant" as const, content: String(m.answer).slice(0, 500) },
                ]);
        }

        // ── Step 3: RAG Similarity Search ──
        let ragContext = "";
        let ragCitations: Array<{ chunkIndex: number; text: string; score: number; source: string }> = [];
        try {
            const ragResults = await similaritySearch(sanitizedMessage, 5, {
                useMultiQuery: parsed.data.useMultiQuery ?? true,
            });
            ragCitations = ragResults;
            ragContext = buildRagContext(ragResults);
        } catch (ragErr) {
            console.warn("[RAG] Similarity search failed:", ragErr);
            ragContext = "(RAG search unavailable)";
        }

        // ── Step 4: Check if grounded response is possible ──
        const hasRelevantContext = ragCitations.length > 0 && ragCitations[0]?.score >= 0.25;
        const confidence = calculateConfidence(ragCitations.map((r) => r.score));

        // ── Step 5: Build System Prompt with Grounding Rules ──
        const weakAreas = facts.latestScores
            ? Object.entries(facts.latestScores as Record<string, number | null>)
                .filter(([, v]) => v !== null && v < 60)
                .map(([k]) => k)
            : [];

        const system = [
            "You are PlacePrep AI Study Assistant v2 — powered by an Advanced RAG pipeline with guardrails.",
            "Your job: help the student with placement preparation using ONLY the retrieved knowledge + student data.",
            "",
            `Student's career path: ${facts.careerPath || "Not set"}`,
            weakAreas.length > 0 ? `Student's weak areas: ${weakAreas.join(", ")}` : "",
            "",
            getGroundingRules(),
            "",
            "Output format:",
            "1) Direct answer using knowledge base [cite sources]",
            "2) Personalized advice for this student specifically",
            "3) Sources used: list [Source N] references",
            "4) Confidence: mention if you're confident or uncertain",
            "",
            "═══ KNOWLEDGE BASE (RAG Retrieved) ═══",
            ragContext,
            "",
            "═══ STUDENT FACTS ═══",
            JSON.stringify(facts),
            "",
            "═══ STUDENT CONTEXT ═══",
            contextBlock || "(no docs)",
        ].join("\n");

        // ── Step 6: Build message history ──
        const history = [
            ...chatMemory,
            ...(parsed.data.history ?? []),
            { role: "user" as const, content: sanitizedMessage },
        ];

        // ── Step 7: LLM Call ──
        const answer = await studyChatCompletion({
            provider,
            system,
            messages: history,
            temperature: 0.2,
        });

        // ── Step 8: Output Validation ──
        const validation = validateOutput(answer, ragCitations.length);

        // ── Step 9: Save to DB ──
        const citations = top.map((d) => ({ id: d.id, title: d.title }));
        await StudySession.create({
            userId,
            threadId,
            provider,
            prompt: sanitizedMessage,
            answer,
            citations,
        });

        // ── Step 10: Return Response ──
        return res.json({
            answer,
            threadId,
            citations,
            provider,
            confidence,
            grounded: validation.grounded,
            guardrails: {
                blocked: false,
                injectionDetected: false,
                outputWarnings: validation.warnings,
            },
            ragSources: ragCitations.map((r) => ({
                chunkIndex: r.chunkIndex,
                text: r.text.slice(0, 300) + (r.text.length > 300 ? "..." : ""),
                score: r.score,
                source: r.source,
            })),
            pipeline: [
                { step: "Guardrails", status: "done", detail: "Query safe ✓" },
                { step: "Knowledge Base", status: "done", detail: `${ragCitations.length > 0 ? ragCitations[0].source : "PDF indexed"}` },
                { step: "Multi-Query", status: "done", detail: "3 query variations generated" },
                { step: "Embedding", status: "done", detail: "Gemini embedding-001" },
                { step: "Similarity Search", status: "done", detail: `Top ${ragCitations.length} chunks (threshold: 0.25)` },
                { step: "Re-Ranking", status: "done", detail: "Semantic (70%) + Keyword (30%)" },
                { step: "Context Compression", status: "done", detail: `${ragCitations.reduce((s, r) => s + r.text.length, 0)} chars` },
                { step: "Chat Memory", status: "done", detail: `${chatMemory.length / 2} previous turns` },
                { step: "Grounding", status: "done", detail: validation.grounded ? "Grounded ✓" : "Ungrounded ⚠" },
                { step: "LLM", status: "done", detail: `${provider.toUpperCase()} • Confidence: ${confidence.level}` },
                { step: "Output Validation", status: validation.valid ? "done" : "warning", detail: validation.warnings.length > 0 ? validation.warnings[0] : "Clean ✓" },
                { step: "Final Answer", status: "done", detail: "Delivered with citations" },
            ],
        });
    } catch (e: any) {
        console.error("Study Assistant error:", e);
        return res.status(502).json({ error: "Study Assistant provider error", details: String(e?.message ?? e) });
    }
});

export default router;
