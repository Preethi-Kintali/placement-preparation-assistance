import { Router, Request } from "express";
import { requireAuth } from "../middleware/auth";
import { chainChat } from "../services/aiChain";
import { extractTextFromPdf } from "../services/resumeAnalyzer";
import { InterviewSession } from "../models/InterviewSession";
import multer from "multer";
import path from "path";
import fs from "fs/promises";
import { parse } from "csv-parse/sync";

export const interviewV2Router = Router();

// ── Multer for resume upload ──────────────────────────────────
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
  fileFilter: (_req, file, cb) => {
    const allowed = [".pdf", ".txt", ".doc", ".docx"];
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, allowed.includes(ext));
  },
});

// ─── Company data from LeetCode CSVs ──────────────────────────
const COMPANY_CSV_DIR = path.resolve(process.cwd(), "..", "lunchpad", "LeetCode-Company-Wise-Questions-main", "LeetCode-Company-Wise-Questions-main");

const TOP_COMPANIES = [
  { id: "google", name: "Google", emoji: "🔍" },
  { id: "amazon", name: "Amazon", emoji: "📦" },
  { id: "microsoft", name: "Microsoft", emoji: "💻" },
  { id: "apple", name: "Apple", emoji: "🍎" },
  { id: "facebook", name: "Meta (Facebook)", emoji: "👤" },
  { id: "netflix", name: "Netflix", emoji: "🎬" },
  { id: "uber", name: "Uber", emoji: "🚗" },
  { id: "adobe", name: "Adobe", emoji: "🎨" },
  { id: "bloomberg", name: "Bloomberg", emoji: "📊" },
  { id: "oracle", name: "Oracle", emoji: "🗄️" },
  { id: "salesforce", name: "Salesforce", emoji: "☁️" },
  { id: "linkedin", name: "LinkedIn", emoji: "💼" },
  { id: "twitter", name: "Twitter/X", emoji: "🐦" },
  { id: "snapchat", name: "Snapchat", emoji: "👻" },
  { id: "spotify", name: "Spotify", emoji: "🎵" },
  { id: "tesla", name: "Tesla", emoji: "⚡" },
  { id: "nvidia", name: "NVIDIA", emoji: "🖥️" },
  { id: "cisco", name: "Cisco", emoji: "🌐" },
  { id: "vmware", name: "VMware", emoji: "🖧" },
  { id: "goldman-sachs", name: "Goldman Sachs", emoji: "🏦" },
  { id: "jpmorgan", name: "JPMorgan", emoji: "💰" },
  { id: "bytedance", name: "ByteDance", emoji: "🎶" },
  { id: "atlassian", name: "Atlassian", emoji: "🔧" },
  { id: "paypal", name: "PayPal", emoji: "💳" },
  { id: "intuit", name: "Intuit", emoji: "📈" },
  { id: "ebay", name: "eBay", emoji: "🛒" },
  { id: "samsung", name: "Samsung", emoji: "📱" },
  { id: "visa", name: "Visa", emoji: "💳" },
  { id: "flipkart", name: "Flipkart", emoji: "🛍️" },
  { id: "infosys", name: "Infosys", emoji: "🏢" },
  { id: "sap", name: "SAP", emoji: "📋" },
  { id: "ibm", name: "IBM", emoji: "🔵" },
  { id: "intel", name: "Intel", emoji: "🧮" },
  { id: "yahoo", name: "Yahoo", emoji: "🟣" },
  { id: "lyft", name: "Lyft", emoji: "🚕" },
  { id: "roblox", name: "Roblox", emoji: "🎮" },
  { id: "doordash", name: "DoorDash", emoji: "🍔" },
  { id: "citadel", name: "Citadel", emoji: "🏛️" },
  { id: "dropbox", name: "Dropbox", emoji: "📂" },
  { id: "reddit", name: "Reddit", emoji: "🤖" },
];

type CompanyQuestion = {
  id: string;
  title: string;
  acceptance: string;
  difficulty: string;
  frequency: number;
  link: string;
};

const companyCache = new Map<string, CompanyQuestion[]>();

async function loadCompanyQuestions(companyId: string): Promise<CompanyQuestion[]> {
  if (companyCache.has(companyId)) return companyCache.get(companyId)!;

  const csvFile = path.join(COMPANY_CSV_DIR, `${companyId}_alltime.csv`);
  try {
    const raw = await fs.readFile(csvFile, "utf-8");
    const rows = parse(raw, { columns: true, skip_empty_lines: true, trim: true }) as any[];
    const questions: CompanyQuestion[] = rows.map((r: any) => ({
      id: String(r.ID || ""),
      title: String(r.Title || ""),
      acceptance: String(r.Acceptance || ""),
      difficulty: String(r.Difficulty || "Medium"),
      frequency: Number(r.Frequency || 0),
      link: String(r["Leetcode Question Link"] || "").trim(),
    })).filter(q => q.title && q.id);

    companyCache.set(companyId, questions);
    return questions;
  } catch {
    return [];
  }
}

// ════════════════════════════════════════════════════════════════
//  RESUME UPLOAD — PDF text extraction via pdf-parse
// ════════════════════════════════════════════════════════════════

interviewV2Router.post("/resume-upload", requireAuth, upload.single("resume"), async (req: Request, res) => {
  try {
    const file = (req as any).file;
    if (!file) return res.status(400).json({ error: "No file uploaded" });

    let text = "";
    const ext = path.extname(file.originalname).toLowerCase();

    if (ext === ".pdf") {
      text = await extractTextFromPdf(file.buffer);
    } else {
      // .txt, .doc, .docx — read as UTF-8
      text = file.buffer.toString("utf-8");
    }

    if (!text || text.trim().length < 20) {
      return res.status(400).json({ error: "Could not extract text from file. Try pasting your resume text instead." });
    }

    return res.json({ text: text.slice(0, 8000), chars: text.length });
  } catch (e: any) {
    console.error("[resume-upload] error:", e?.message);
    return res.status(500).json({ error: "Failed to process PDF. Try pasting resume text directly." });
  }
});

// ════════════════════════════════════════════════════════════════
//  RESUME EXTRACT — AI skill extraction from resume text
// ════════════════════════════════════════════════════════════════

interviewV2Router.post("/resume-extract", requireAuth, async (req, res) => {
  const { resumeText } = req.body;
  if (!resumeText || typeof resumeText !== "string" || resumeText.trim().length < 20) {
    return res.status(400).json({ error: "Resume text too short. Please provide more content." });
  }

  try {
    const cleanText = resumeText
      .replace(/[^\x20-\x7E\n\r\t]/g, " ")  // Remove non-ASCII binary junk
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 5000);

    const { text } = await chainChat(
      `You are analyzing a candidate's resume. Extract:
1. All technical skills, programming languages, tools, and frameworks mentioned
2. 5-7 specific interview topics based on the candidate's projects, work experience, and skills
3. Their experience level (junior/mid/senior)

Focus especially on their PROJECTS — generate questions about what they built, technologies they used, and challenges they solved.

Resume content:
"""
${cleanText}
"""

Return ONLY valid JSON, no markdown or extra text:
{"skills": ["React", "Node.js", ...], "topics": ["Explain your e-commerce project architecture", "How did you implement authentication in your app", ...], "experience_level": "junior|mid|senior"}`,
      { system: "You are a senior technical recruiter. Parse resumes accurately and generate interview topics focused on the candidate's actual projects and experience.", temperature: 0.3 }
    );

    // Parse JSON robustly
    const first = text.indexOf("{");
    const last = text.lastIndexOf("}");
    if (first >= 0 && last > first) {
      const jsonStr = text.slice(first, last + 1);
      const parsed = JSON.parse(jsonStr);
      return res.json({
        skills: Array.isArray(parsed.skills) ? parsed.skills.slice(0, 20) : [],
        topics: Array.isArray(parsed.topics) ? parsed.topics.slice(0, 7) : [],
        experienceLevel: parsed.experience_level || "mid",
      });
    }

    // Fallback: if AI didn't return JSON, try to extract skills manually
    throw new Error("AI did not return valid JSON");
  } catch (e: any) {
    console.error("[resume-extract] error:", e?.message);
    // Fallback: basic keyword extraction
    const lower = resumeText.toLowerCase();
    const commonSkills = ["python", "java", "javascript", "react", "node.js", "mongodb", "sql", "html", "css", "c++", "typescript", "git", "docker", "aws", "flask", "django", "express", "angular", "vue", "tensorflow", "pytorch", "machine learning", "data structures", "algorithms"];
    const found = commonSkills.filter(s => lower.includes(s));
    if (found.length > 0) {
      return res.json({
        skills: found,
        topics: found.slice(0, 5).map(s => `Explain your experience with ${s} and a project where you used it`),
        experienceLevel: "mid",
      });
    }
    return res.status(500).json({ error: "Failed to analyze resume. Try pasting plain text.", details: e?.message });
  }
});

// ════════════════════════════════════════════════════════════════
//  RESUME QUESTIONS — Generate interview questions from skills
// ════════════════════════════════════════════════════════════════

interviewV2Router.post("/resume-questions", requireAuth, async (req, res) => {
  const { skills, topics, experienceLevel } = req.body;
  if (!Array.isArray(topics) || !topics.length) return res.status(400).json({ error: "No topics provided" });

  try {
    const topicList = topics.slice(0, 7);
    const { text } = await chainChat(
      `You are a senior technical interviewer. Generate exactly one interview question for each topic below.

The candidate is ${experienceLevel || "mid"}-level with skills in: ${(skills || []).slice(0, 15).join(", ")}.

Make questions practical and conversational — ask about their experience, their projects, tradeoffs they considered, and how they'd solve real problems.

Topics:
${topicList.map((t: string, i: number) => `${i + 1}. ${t}`).join("\n")}

Return strict JSON only:
{"questions": [{"topic": "<exact topic>", "question": "<interview question>"}]}`,
      { system: "You are an expert technical interviewer at a top tech company.", temperature: 0.4 }
    );

    const first = text.indexOf("{");
    const last = text.lastIndexOf("}");
    if (first >= 0 && last > first) {
      const parsed = JSON.parse(text.slice(first, last + 1));
      if (Array.isArray(parsed.questions) && parsed.questions.length > 0) {
        return res.json({ questions: parsed.questions });
      }
    }
    // Fallback
    return res.json({ questions: topicList.map((t: string) => ({ topic: t, question: `Tell me about your experience with ${t}. Walk me through a project where you used this and the challenges you faced.` })) });
  } catch {
    return res.json({
      questions: (topics || []).slice(0, 7).map((t: string) => ({
        topic: t,
        question: `Tell me about your experience with ${t}. Walk me through a project where you used this.`,
      })),
    });
  }
});

// ════════════════════════════════════════════════════════════════
//  SAVE SESSION — Store resume/company interview sessions
// ════════════════════════════════════════════════════════════════

interviewV2Router.post("/save-session", requireAuth, async (req: Request, res) => {
  try {
    const userId = (req as any).userId;
    const { interviewType, companyName, topics, answers, durationSeconds } = req.body;

    if (!Array.isArray(answers) || !answers.length) {
      return res.status(400).json({ error: "No answers to save" });
    }

    const overallScore = answers.reduce((s: number, a: any) => s + (Number(a.score) || 0), 0) / answers.length;

    const session = await InterviewSession.create({
      userId,
      currentWeek: 0, // 0 = resume/company interview (not weekly)
      topics: topics || [interviewType || "resume", companyName || ""].filter(Boolean),
      answers: answers.map((a: any) => ({
        topic: String(a.topic || ""),
        question: String(a.question || ""),
        answer: String(a.answer || ""),
        score: Number(a.score) || 0,
        feedback: String(a.feedback || ""),
        quickTip: String(a.quickTip || ""),
      })),
      overallScore: Number(overallScore.toFixed(1)),
      communicationScore: Number(overallScore.toFixed(1)),
      dsaScore: Number(overallScore.toFixed(1)),
      technicalScore: Number(overallScore.toFixed(1)),
      durationSeconds: Number(durationSeconds) || 0,
      completedAt: new Date(),
    });

    return res.json({ ok: true, sessionId: session._id, overallScore: Number(overallScore.toFixed(1)) });
  } catch (e: any) {
    console.error("[save-session] error:", e?.message);
    return res.status(500).json({ error: "Failed to save session" });
  }
});

// ════════════════════════════════════════════════════════════════
//  COMPANY ENDPOINTS
// ════════════════════════════════════════════════════════════════

// ─── GET /companies ───────────────────────────────────────────
interviewV2Router.get("/companies", requireAuth, async (_req, res) => {
  const companies = await Promise.all(
    TOP_COMPANIES.map(async (c) => {
      const qs = await loadCompanyQuestions(c.id);
      const easy = qs.filter(q => q.difficulty === "Easy").length;
      const medium = qs.filter(q => q.difficulty === "Medium").length;
      const hard = qs.filter(q => q.difficulty === "Hard").length;
      return {
        ...c,
        logo: `https://logo.clearbit.com/${c.id === "facebook" ? "meta.com" : c.id === "goldman-sachs" ? "goldmansachs.com" : c.id === "jpmorgan" ? "jpmorgan.com" : `${c.id.replace(/-/g, "")}.com`}`,
        totalQuestions: qs.length,
        easy, medium, hard,
      };
    })
  );
  return res.json({ companies });
});

// ─── GET /company-questions/:companyId ────────────────────────
interviewV2Router.get("/company-questions/:companyId", requireAuth, async (req, res) => {
  const companyId = String(req.params.companyId).toLowerCase();
  const limit = Math.min(Number(req.query.limit) || 10, 50);
  const difficulty = String(req.query.difficulty || "all").toLowerCase();

  let questions = await loadCompanyQuestions(companyId);
  if (!questions.length) return res.status(404).json({ error: "Company not found or no questions available" });

  if (difficulty !== "all") {
    const filtered = questions.filter(q => q.difficulty.toLowerCase() === difficulty);
    if (filtered.length) questions = filtered;
  }

  questions.sort((a, b) => b.frequency - a.frequency);
  const selected = questions.slice(0, limit);
  return res.json({ companyId, total: questions.length, questions: selected });
});

// ─── POST /company-interview-question ─────────────────────────
interviewV2Router.post("/company-interview-question", requireAuth, async (req, res) => {
  const { title, difficulty, companyName } = req.body;
  if (!title) return res.status(400).json({ error: "Missing title" });

  try {
    const { text } = await chainChat(
      `Generate one technical interview question that a candidate might be asked at ${companyName || "a tech company"} based on this LeetCode problem: "${title}" (${difficulty} difficulty).\n\nThe question should be conversational and practical — not just "solve this problem". Ask them to explain their approach, time complexity, and edge cases.\n\nReturn ONLY the question text, no preamble.`,
      { system: "You are a senior technical interviewer at a top tech company.", temperature: 0.5 }
    );
    return res.json({ question: text.trim() });
  } catch {
    return res.json({ question: `Explain your approach to solving "${title}". What data structures would you use? What is the time and space complexity? What edge cases would you consider?` });
  }
});

// ─── POST /company-prep ───────────────────────────────────────
interviewV2Router.post("/company-prep", requireAuth, async (req, res) => {
  const { companyId, companyName } = req.body;
  if (!companyId) return res.status(400).json({ error: "Missing companyId" });

  const questions = await loadCompanyQuestions(companyId);
  const easy = questions.filter(q => q.difficulty === "Easy").length;
  const medium = questions.filter(q => q.difficulty === "Medium").length;
  const hard = questions.filter(q => q.difficulty === "Hard").length;

  const sorted = [...questions].sort((a, b) => b.frequency - a.frequency);
  const top10 = sorted.slice(0, 10);

  const topicKeywords = ["array", "string", "tree", "graph", "dp", "dynamic programming", "linked list", "hash", "stack", "queue", "binary search", "sort", "greedy", "backtracking", "math", "design", "sliding window", "two pointer", "bfs", "dfs", "heap"];
  const topicCounts: Record<string, number> = {};
  for (const q of questions) {
    const lower = q.title.toLowerCase();
    for (const kw of topicKeywords) {
      if (lower.includes(kw)) {
        topicCounts[kw] = (topicCounts[kw] || 0) + 1;
      }
    }
  }
  const topTopics = Object.entries(topicCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([topic, count]) => ({ topic, count }));

  try {
    const { text } = await chainChat(
      `Generate a 4-week preparation roadmap for ${companyName || companyId} technical interviews. The company asks ${questions.length} LeetCode problems (${easy} Easy, ${medium} Medium, ${hard} Hard). Top topics: ${topTopics.map(t => t.topic).join(", ")}.\n\nReturn JSON:\n{"weeks": [{"week": 1, "title": "...", "focus": "...", "tasks": ["task1", "task2"]}], "tips": ["tip1", "tip2", "tip3"]}`,
      { system: "You are a career coach specializing in FAANG interview preparation.", temperature: 0.4 }
    );

    let roadmap = { weeks: [] as any[], tips: [] as string[] };
    const first = text.indexOf("{");
    const last = text.lastIndexOf("}");
    if (first >= 0 && last > first) {
      const parsed = JSON.parse(text.slice(first, last + 1));
      roadmap = { weeks: parsed.weeks || [], tips: parsed.tips || [] };
    }

    return res.json({
      companyId, companyName: companyName || companyId,
      totalQuestions: questions.length, difficulty: { easy, medium, hard },
      topTopics, top10Questions: top10, roadmap,
    });
  } catch {
    return res.json({
      companyId, companyName: companyName || companyId,
      totalQuestions: questions.length, difficulty: { easy, medium, hard },
      topTopics, top10Questions: top10,
      roadmap: { weeks: [], tips: ["Practice easy problems first", "Focus on Arrays and Strings", "Do mock interviews weekly"] },
    });
  }
});
