import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import { chainChat } from "../services/aiChain";
import path from "path";
import fs from "fs/promises";
import { parse } from "csv-parse/sync";

export const interviewV2Router = Router();

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

// ─── GET /companies — List top companies ──────────────────────
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

// ─── GET /company-questions/:companyId — Get questions ────────
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

  // Sort by frequency (highest first) and take top N
  questions.sort((a, b) => b.frequency - a.frequency);
  const selected = questions.slice(0, limit);

  return res.json({ companyId, total: questions.length, questions: selected });
});

// ─── POST /company-interview-question — AI generates an interview question from a LeetCode problem ──
interviewV2Router.post("/company-interview-question", requireAuth, async (req, res) => {
  const { title, difficulty, companyName } = req.body;
  if (!title) return res.status(400).json({ error: "Missing title" });

  try {
    const { text } = await chainChat(
      `Generate one technical interview question that a candidate might be asked at ${companyName || "a tech company"} based on this LeetCode problem: "${title}" (${difficulty} difficulty).\n\nThe question should be conversational and practical — not just "solve this problem". Ask them to explain their approach, time complexity, and edge cases.\n\nReturn ONLY the question text, no preamble.`,
      { system: "You are a senior technical interviewer at a top tech company.", temperature: 0.5 }
    );
    return res.json({ question: text.trim() });
  } catch (e: any) {
    return res.json({ question: `Explain your approach to solving "${title}". What data structures would you use? What is the time and space complexity? What edge cases would you consider?` });
  }
});

// ─── POST /resume-extract — Extract skills from resume text ───
interviewV2Router.post("/resume-extract", requireAuth, async (req, res) => {
  const { resumeText } = req.body;
  if (!resumeText || typeof resumeText !== "string" || resumeText.length < 20) {
    return res.status(400).json({ error: "Resume text too short" });
  }

  try {
    const { text } = await chainChat(
      `Extract key technical skills, tools, frameworks, and programming languages from this resume. Then generate 5-7 interview topics based on the candidate's experience.\n\nResume:\n${resumeText.slice(0, 4000)}\n\nReturn ONLY JSON:\n{"skills": ["skill1", "skill2"], "topics": ["topic for interview question 1", "topic 2"], "experience_level": "junior|mid|senior"}`,
      { system: "You are a resume parser. Extract technical skills accurately.", temperature: 0.2 }
    );

    // Parse JSON
    const first = text.indexOf("{");
    const last = text.lastIndexOf("}");
    if (first >= 0 && last > first) {
      const parsed = JSON.parse(text.slice(first, last + 1));
      return res.json({
        skills: Array.isArray(parsed.skills) ? parsed.skills : [],
        topics: Array.isArray(parsed.topics) ? parsed.topics : [],
        experienceLevel: parsed.experience_level || "mid",
      });
    }
    throw new Error("Invalid JSON");
  } catch (e: any) {
    return res.status(500).json({ error: "Failed to parse resume", details: e?.message });
  }
});

// ─── POST /resume-questions — Generate interview questions from skills ──
interviewV2Router.post("/resume-questions", requireAuth, async (req, res) => {
  const { skills, topics, experienceLevel } = req.body;
  if (!Array.isArray(topics) || !topics.length) return res.status(400).json({ error: "No topics provided" });

  try {
    const topicList = topics.slice(0, 7);
    const { text } = await chainChat(
      `Generate exactly one interview question for each topic below. The candidate is ${experienceLevel || "mid"}-level with skills in: ${(skills || []).slice(0, 15).join(", ")}.\n\nTopics:\n${topicList.map((t: string, i: number) => `${i + 1}. ${t}`).join("\n")}\n\nReturn strict JSON:\n{"questions": [{"topic": "<exact topic>", "question": "<interview question>"}]}`,
      { system: "You are an expert technical interviewer. Generate practical interview questions.", temperature: 0.4 }
    );

    const first = text.indexOf("{");
    const last = text.lastIndexOf("}");
    if (first >= 0 && last > first) {
      const parsed = JSON.parse(text.slice(first, last + 1));
      return res.json({ questions: parsed.questions || [] });
    }
    // Fallback
    return res.json({ questions: topicList.map((t: string) => ({ topic: t, question: `Explain ${t} with a practical example and discuss tradeoffs.` })) });
  } catch {
    return res.json({
      questions: (topics || []).slice(0, 7).map((t: string) => ({
        topic: t,
        question: `Explain ${t} with a practical example. What are the trade-offs?`,
      })),
    });
  }
});

// ─── POST /company-prep — Generate company preparation sheet via AI ──
interviewV2Router.post("/company-prep", requireAuth, async (req, res) => {
  const { companyId, companyName } = req.body;
  if (!companyId) return res.status(400).json({ error: "Missing companyId" });

  const questions = await loadCompanyQuestions(companyId);
  const easy = questions.filter(q => q.difficulty === "Easy").length;
  const medium = questions.filter(q => q.difficulty === "Medium").length;
  const hard = questions.filter(q => q.difficulty === "Hard").length;

  // Get top 10 by frequency
  const sorted = [...questions].sort((a, b) => b.frequency - a.frequency);
  const top10 = sorted.slice(0, 10);

  // Detect common topics from question titles
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
      companyId,
      companyName: companyName || companyId,
      totalQuestions: questions.length,
      difficulty: { easy, medium, hard },
      topTopics,
      top10Questions: top10,
      roadmap,
    });
  } catch {
    return res.json({
      companyId,
      companyName: companyName || companyId,
      totalQuestions: questions.length,
      difficulty: { easy, medium, hard },
      topTopics,
      top10Questions: top10,
      roadmap: { weeks: [], tips: ["Practice easy problems first", "Focus on Arrays and Strings", "Do mock interviews weekly"] },
    });
  }
});
