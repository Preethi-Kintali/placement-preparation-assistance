import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth";
import { env } from "../config/env";
import { fetchJson } from "../services/http";
import { RoadmapPlan } from "../models/RoadmapPlan";
import { RoadmapProgress } from "../models/RoadmapProgress";
import { InterviewSession } from "../models/InterviewSession";
import { User } from "../models/User";
import { checkAndUnlockInterviewBadges, recordActivity, utcDateKey } from "../services/gamification";
import { sendEmail } from "../services/mailer";

type ProviderId = "groq" | "gemini";

type GroqChatResponse = {
  choices?: Array<{ message?: { content?: string } }>;
};

type GeminiResponse = {
  candidates?: Array<{
    content?: {
      parts?: Array<{ text?: string }>;
    };
  }>;
};

type TopicQuestion = {
  topic: string;
  question: string;
};

const questionsResponseSchema = z.object({
  questions: z.array(
    z.object({
      topic: z.string().min(1),
      question: z.string().min(6),
    })
  ),
});

const scoreResponseSchema = z.object({
  score: z.number().min(0).max(10),
  feedback: z.string().min(3),
  quickTip: z.string().min(3),
});

const scoreBodySchema = z.object({
  topic: z.string().min(1),
  question: z.string().min(3),
  answer: z.string().min(1),
});

const completeBodySchema = z.object({
  currentWeek: z.number().int().min(1),
  topics: z.array(z.string().min(1)).min(1),
  durationSeconds: z.number().int().min(0).max(24 * 60 * 60).default(0),
  answers: z.array(
    z.object({
      topic: z.string().min(1),
      question: z.string().min(3),
      answer: z.string().min(1),
      score: z.number().min(0).max(10),
      feedback: z.string().min(1),
      quickTip: z.string().min(1),
    })
  ).min(1),
});

async function getCurrentWeekTopics(userId: string): Promise<{ currentWeek: number; topics: string[] }> {
  const [progress, plan] = await Promise.all([
    RoadmapProgress.findOne({ userId }).lean(),
    RoadmapPlan.findOne({ userId }).lean(),
  ]);

  if (!progress || !plan || !Array.isArray((plan as any).weeks) || !(plan as any).weeks.length) {
    throw new Error("Roadmap not available. Complete assessments and unlock roadmap first.");
  }

  const currentWeek = Math.max(1, Number(progress.unlockedWeek ?? 1));
  const week = (plan as any).weeks.find((w: any) => Number(w.week) === currentWeek) ?? (plan as any).weeks[0];
  const topics = Array.from(
    new Set(
      ((week?.days as Array<{ topic?: string }> | undefined) ?? [])
        .map((d) => String(d?.topic ?? "").trim())
        .filter(Boolean)
    )
  );

  if (!topics.length) {
    throw new Error("Current week topics not found.");
  }

  return { currentWeek, topics };
}

function extractJsonObject(text: string): any {
  const raw = String(text ?? "").trim();
  try {
    return JSON.parse(raw);
  } catch {
    const first = raw.indexOf("{");
    const last = raw.lastIndexOf("}");
    if (first >= 0 && last > first) {
      const sliced = raw.slice(first, last + 1);
      return JSON.parse(sliced);
    }
    throw new Error("Invalid JSON response");
  }
}

function normalizeQuestionText(text: string): string {
  return String(text ?? "")
    .replace(/^\s*\d+[).:-]?\s*/, "")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeQuestionsForTopics(input: TopicQuestion[], topics: string[]): TopicQuestion[] {
  const byTopic = new Map<string, string>();

  for (const row of input) {
    const topic = String(row.topic ?? "").trim();
    const question = normalizeQuestionText(row.question);
    if (!topic || !question) continue;
    if (!byTopic.has(topic)) byTopic.set(topic, question);
  }

  const out: TopicQuestion[] = [];
  const usedQuestions = new Set<string>();
  for (const topic of topics) {
    let question = byTopic.get(topic) ?? "";
    if (!question) {
      question = `Explain ${topic} clearly with one practical example and one common mistake to avoid.`;
    }

    let candidate = question;
    if (usedQuestions.has(candidate.toLowerCase())) {
      candidate = `${candidate} Also discuss one real-world trade-off for ${topic}.`;
    }

    usedQuestions.add(candidate.toLowerCase());
    out.push({ topic, question: candidate });
  }

  return out;
}

async function callGroq(prompt: string): Promise<string> {
  if (!env.INTERVIEW_GROQ_API_KEY) throw new Error("INTERVIEW_GROQ_API_KEY not configured");
  const data = await fetchJson<GroqChatResponse>("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${env.INTERVIEW_GROQ_API_KEY}`,
    },
    body: JSON.stringify({
      model: "llama-3.3-70b-versatile",
      temperature: 0.3,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  return data.choices?.[0]?.message?.content?.trim() ?? "";
}

async function callGemini(prompt: string): Promise<string> {
  if (!env.INTERVIEW_GEMINI_API_KEY) throw new Error("INTERVIEW_GEMINI_API_KEY not configured");
  const url =
    "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=" +
    encodeURIComponent(env.INTERVIEW_GEMINI_API_KEY);

  const data = await fetchJson<GeminiResponse>(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.3, maxOutputTokens: 700 },
    }),
  });

  return data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("").trim() ?? "";
}

async function callFirstAvailable(prompt: string, preferred?: ProviderId): Promise<{ text: string; source: ProviderId }> {
  const order: ProviderId[] = preferred
    ? preferred === "groq"
      ? ["groq", "gemini"]
      : ["gemini", "groq"]
    : ["groq", "gemini"];

  let lastErr: any;
  for (const provider of order) {
    try {
      if (provider === "groq") return { text: await callGroq(prompt), source: "groq" };
      return { text: await callGemini(prompt), source: "gemini" };
    } catch (err) {
      lastErr = err;
    }
  }
  throw lastErr ?? new Error("No AI provider available");
}

function buildQuestionsPrompt(topics: string[]): string {
  return `Generate exactly one interview question per topic.\n\nTopics:\n${topics.map((t, i) => `${i + 1}. ${t}`).join("\n")}\n\nReturn strict JSON only in this format:\n{\n  "questions": [\n    { "topic": "<exact topic text>", "question": "<single practical interview question>" }\n  ]\n}\n\nRules:\n- Include every topic exactly once\n- Questions must be different and topic-specific\n- No numbering in question text\n- No markdown or extra commentary`;
}

function buildScorePrompt(input: { topic: string; question: string; answer: string }): string {
  return `You are a strict but fair interview evaluator.\n\nTopic: "${input.topic}"\nQuestion: "${input.question}"\nCandidate answer: "${input.answer}"\n\nReturn strict JSON only:\n{\n  "score": number,\n  "feedback": string,\n  "quickTip": string\n}\n\nScoring rules:\n- score from 0 to 10 (one decimal allowed)\n- feedback must mention what was correct and what was missing\n- quickTip must be specific to this topic and answer (not generic).`;
}

function fallbackQuestions(topics: string[]): TopicQuestion[] {
  return topics.map((topic) => ({
    topic,
    question: `For ${topic}, explain core concepts, one real-world use case, and one key trade-off.`,
  }));
}

function fallbackScore(input: { topic: string; answer: string }) {
  const words = String(input.answer).trim().split(/\s+/).filter(Boolean).length;
  let score = 5;
  if (words > 20) score += 1;
  if (words > 60) score += 1.2;
  if (/example|trade[\s-]?off|complexity|edge case|scal/i.test(input.answer)) score += 1.3;
  score = Math.min(9.3, Math.round(score * 10) / 10);

  return {
    score,
    feedback: `You covered some basics for ${input.topic}. Improve depth with clearer structure and practical reasoning.`,
    quickTip: `For ${input.topic}, first define the concept, then give one concrete example, and finally explain one trade-off.`,
    source: "fallback" as const,
  };
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function avgOrDefault(items: number[], fallback: number): number {
  if (!items.length) return round1(fallback);
  return round1(items.reduce((sum, v) => sum + v, 0) / items.length);
}

function isDsaTopic(topic: string): boolean {
  return /\b(dsa|array|string|linked list|stack|queue|tree|graph|dp|dynamic programming|recursion|backtracking|heap|hash|algorithm)\b/i.test(topic);
}

function isCommunicationTopic(topic: string): boolean {
  return /\b(communication|presentation|soft\s*skills?|hr|behavioral|clarity|storytelling|collaboration)\b/i.test(topic);
}

function computeSessionScores(answers: Array<{ topic: string; score: number }>) {
  const allScores = answers.map((a) => Number(a.score) || 0);
  const dsaScores = answers.filter((a) => isDsaTopic(a.topic)).map((a) => Number(a.score) || 0);
  const communicationScores = answers.filter((a) => isCommunicationTopic(a.topic)).map((a) => Number(a.score) || 0);
  const technicalScores = answers
    .filter((a) => !isCommunicationTopic(a.topic))
    .map((a) => Number(a.score) || 0);

  const overallScore = avgOrDefault(allScores, 0);
  const dsaScore = avgOrDefault(dsaScores, overallScore);
  const communicationScore = avgOrDefault(communicationScores, overallScore);
  const technicalScore = avgOrDefault(technicalScores, overallScore);

  return { overallScore, dsaScore, communicationScore, technicalScore };
}

export const interviewRouter = Router();

interviewRouter.get("/health", (_req, res) => {
  res.json({ ok: true, timestamp: Date.now() });
});

interviewRouter.get("/context", requireAuth, async (req, res) => {
  try {
    const { currentWeek, topics } = await getCurrentWeekTopics(req.user!.userId);
    res.json({ currentWeek, topics, topicsText: topics.join(", ") });
  } catch (error: any) {
    res.status(400).json({ error: error?.message ?? "Unable to load interview context" });
  }
});

interviewRouter.get("/questions", requireAuth, async (req, res) => {
  try {
    const { currentWeek, topics } = await getCurrentWeekTopics(req.user!.userId);
    const prompt = buildQuestionsPrompt(topics);

    try {
      const { text, source } = await callFirstAvailable(prompt);
      const parsed = questionsResponseSchema.parse(extractJsonObject(text));
      const normalized = normalizeQuestionsForTopics(parsed.questions, topics);
      return res.json({ currentWeek, topics, questions: normalized, source, dynamic: true });
    } catch {
      return res.json({
        currentWeek,
        topics,
        questions: fallbackQuestions(topics),
        source: "fallback",
        dynamic: false,
      });
    }
  } catch (error: any) {
    return res.status(400).json({ error: error?.message ?? "Unable to generate questions" });
  }
});

interviewRouter.post("/score", requireAuth, async (req, res) => {
  const parsed = scoreBodySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid payload", details: parsed.error.flatten() });
  }

  const { topic, question, answer } = parsed.data;

  try {
    const prompt = buildScorePrompt({ topic, question, answer });

    try {
      const { text, source } = await callFirstAvailable(prompt, "groq");
      const scored = scoreResponseSchema.parse(extractJsonObject(text));
      const score = Math.max(0, Math.min(10, Math.round(Number(scored.score) * 10) / 10));
      return res.json({ score, feedback: scored.feedback, quickTip: scored.quickTip, source });
    } catch {
      const fallback = fallbackScore({ topic, answer });
      return res.json(fallback);
    }
  } catch (error: any) {
    return res.status(500).json({ error: error?.message ?? "Failed to score answer" });
  }
});

interviewRouter.post("/sessions", requireAuth, async (req, res) => {
  const parsed = completeBodySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid payload", details: parsed.error.flatten() });
  }

  const payload = parsed.data;
  const scores = computeSessionScores(payload.answers);

  const session = await InterviewSession.create({
    userId: req.user!.userId,
    currentWeek: payload.currentWeek,
    topics: payload.topics,
    answers: payload.answers.map((a) => ({
      topic: a.topic,
      question: a.question,
      answer: a.answer,
      score: round1(Number(a.score) || 0),
      feedback: a.feedback,
      quickTip: a.quickTip,
    })),
    overallScore: scores.overallScore,
    communicationScore: scores.communicationScore,
    dsaScore: scores.dsaScore,
    technicalScore: scores.technicalScore,
    durationSeconds: payload.durationSeconds,
    completedAt: new Date(),
  });

  await recordActivity({
    userId: req.user!.userId,
    dateKey: utcDateKey(),
    type: "interview_completed",
    title: `Completed interview session (Week ${payload.currentWeek})`,
    meta: {
      currentWeek: payload.currentWeek,
      overallScore: session.overallScore,
      dsaScore: session.dsaScore,
      communicationScore: session.communicationScore,
      technicalScore: session.technicalScore,
    },
  });

  const unlockedBadges = await checkAndUnlockInterviewBadges(req.user!.userId);

  // Optional email notification
  try {
    const u = await User.findById(req.user!.userId).select({ "profile.email": 1, "profile.fullName": 1 }).lean();
    const to = String((u as any)?.profile?.email ?? "").trim();
    if (to) {
      await sendEmail({
        to,
        subject: "PlacePrep: AI Interview completed",
        text:
          `Hi ${(u as any)?.profile?.fullName ?? "Student"},\n\n` +
          `You completed an AI Interview session (Week ${payload.currentWeek}).\n` +
          `Overall: ${session.overallScore}/10\n` +
          `Communication: ${session.communicationScore}/10\n` +
          `DSA: ${session.dsaScore}/10\n` +
          `Technical: ${session.technicalScore}/10\n\n` +
          `PlacePrep`,
      });
    }
  } catch {
    // ignore
  }

  return res.json({
    id: String(session._id),
    overallScore: session.overallScore,
    communicationScore: session.communicationScore,
    dsaScore: session.dsaScore,
    technicalScore: session.technicalScore,
    completedAt: session.completedAt,
    unlockedBadges,
  });
});

interviewRouter.get("/sessions", requireAuth, async (req, res) => {
  const sessions = await InterviewSession.find({ userId: req.user!.userId })
    .sort({ completedAt: -1 })
    .limit(20)
    .lean();

  return res.json({
    sessions: sessions.map((s: any) => ({
      id: String(s._id),
      currentWeek: s.currentWeek,
      topics: s.topics,
      overallScore: s.overallScore,
      communicationScore: s.communicationScore,
      dsaScore: s.dsaScore,
      technicalScore: s.technicalScore,
      durationSeconds: s.durationSeconds,
      completedAt: s.completedAt,
      answers: s.answers,
    })),
  });
});

// Backward-compatible aliases used by earlier UI drafts
interviewRouter.get("/round-questions", requireAuth, async (req, res) => {
  try {
    const idx = Number(req.query.roundIndex ?? 0);
    const { topics } = await getCurrentWeekTopics(req.user!.userId);
    const base = fallbackQuestions(topics);
    const start = Math.max(0, idx * 3);
    const selected = base.slice(start, start + 3).map((q) => q.question);
    return res.json({ questions: selected, source: "fallback", dynamic: false });
  } catch {
    return res.status(500).json({ error: "Failed to generate questions" });
  }
});

interviewRouter.post("/ask", requireAuth, async (req, res) => {
  const topic = String(req.body?.topic ?? "General");
  const question = String(req.body?.question ?? "");
  const answer = String(req.body?.answer ?? "");
  if (!question || !answer) return res.status(400).json({ error: "Invalid payload" });

  const fallback = fallbackScore({ topic, answer });
  return res.json({
    score: fallback.score,
    feedback: `${fallback.feedback}\n\nQuick tip: ${fallback.quickTip}`,
    next_question: true,
    source: fallback.source,
  });
});
