import { User } from "../models/User";
import { ExamAttempt } from "../models/ExamAttempt";
import { RoadmapPlan } from "../models/RoadmapPlan";
import { RoadmapProgress } from "../models/RoadmapProgress";
import { RequirementSnapshot } from "../models/RequirementSnapshot";
import { InterviewSession } from "../models/InterviewSession";

export type RagDoc = {
  id: string;
  title: string;
  text: string;
};

const STOPWORDS = new Set(
  [
    "the",
    "a",
    "an",
    "and",
    "or",
    "to",
    "of",
    "in",
    "on",
    "for",
    "with",
    "is",
    "are",
    "was",
    "were",
    "be",
    "been",
    "being",
    "i",
    "you",
    "we",
    "they",
    "it",
    "this",
    "that",
    "these",
    "those",
    "as",
    "at",
    "by",
    "from",
    "can",
    "could",
    "should",
    "would",
    "what",
    "how",
    "when",
    "where",
    "why",
    "please",
    "help",
    "today",
  ].map((w) => w.toLowerCase())
);

function tokenize(text: string): string[] {
  return String(text || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 3)
    .filter((t) => !STOPWORDS.has(t));
}

function tf(tokens: string[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const t of tokens) m.set(t, (m.get(t) ?? 0) + 1);
  return m;
}

function buildIdf(docs: RagDoc[]): Map<string, number> {
  const df = new Map<string, number>();
  for (const d of docs) {
    const uniq = new Set(tokenize(d.text));
    for (const t of uniq) df.set(t, (df.get(t) ?? 0) + 1);
  }
  const N = docs.length || 1;
  const idf = new Map<string, number>();
  for (const [t, n] of df.entries()) {
    idf.set(t, Math.log((N + 1) / (n + 1)) + 1);
  }
  return idf;
}

export function retrieveTopDocs(input: { docs: RagDoc[]; query: string; k?: number }): RagDoc[] {
  const k = Math.max(1, Math.min(10, input.k ?? 5));
  const docs = input.docs;
  if (!docs.length) return [];

  const queryTokens = tokenize(input.query);
  if (!queryTokens.length) return docs.slice(0, k);

  const idf = buildIdf(docs);
  const qSet = new Set(queryTokens);

  const scored = docs
    .map((d) => {
      const tokens = tokenize(d.text);
      const tfs = tf(tokens);
      let score = 0;
      for (const t of qSet) {
        const f = tfs.get(t) ?? 0;
        if (!f) continue;
        score += (idf.get(t) ?? 1) * (1 + Math.log(f));
      }
      return { d, score };
    })
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, k)
    .map((s) => s.d);

  return scored.length ? scored : docs.slice(0, k);
}

function clip(text: string, max = 1600): string {
  const s = String(text || "").trim();
  if (s.length <= max) return s;
  return s.slice(0, max - 3) + "...";
}

export async function buildStudentRagDocs(userId: string): Promise<{
  facts: Record<string, unknown>;
  docs: RagDoc[];
}> {
  const [user, attempts, plan, progress, latestReq, latestInterview] = await Promise.all([
    User.findById(userId).lean(),
    ExamAttempt.find({ userId }).sort({ createdAt: -1 }).lean(),
    RoadmapPlan.findOne({ userId }).lean(),
    RoadmapProgress.findOne({ userId }).lean(),
    RequirementSnapshot.findOne({ userId }).sort({ generatedAt: -1 }).lean(),
    InterviewSession.findOne({ userId }).sort({ completedAt: -1 }).lean(),
  ]);

  const latestByType = new Map<string, any>();
  for (const a of attempts) {
    const key = String((a as any).examType);
    if (!latestByType.has(key)) latestByType.set(key, a);
  }

  const careerPath = (user as any)?.profile?.career?.careerPath || "Full Stack Developer";
  const targetCompany = (user as any)?.profile?.career?.targetCompany || null;
  const targetLpa = (user as any)?.profile?.career?.targetLpa || null;

  const unlockedWeek = Number(progress?.unlockedWeek ?? 1);
  const week = (plan as any)?.weeks?.find?.((w: any) => Number(w.week) === unlockedWeek);
  const weekTopics = Array.isArray(week?.days) ? week.days.map((d: any) => String(d.topic ?? "").trim()).filter(Boolean) : [];
  const weekDays = Array.isArray(week?.days) ? week.days : [];
  const weekByCategory = weekDays.reduce(
    (acc: Record<string, string[]>, d: any) => {
      const cat = String(d.category ?? "unknown");
      const topic = String(d.topic ?? "").trim();
      if (!topic) return acc;
      acc[cat] = acc[cat] || [];
      acc[cat].push(topic);
      return acc;
    },
    {}
  );

  const facts: Record<string, unknown> = {
    careerPath,
    targetCompany,
    targetLpa,
    unlockedWeek,
    weekTopics,
    latestScores: {
      aptitude: latestByType.get("aptitude")?.percentage ?? null,
      dsa: latestByType.get("dsa")?.percentage ?? null,
      softSkills: latestByType.get("soft_skills")?.percentage ?? null,
      career: latestByType.get("career")?.percentage ?? null,
    },
    latestInterview: latestInterview
      ? {
          overallScore: latestInterview.overallScore,
          communicationScore: latestInterview.communicationScore,
          dsaScore: latestInterview.dsaScore,
          technicalScore: latestInterview.technicalScore,
          completedAt: latestInterview.completedAt,
        }
      : null,
  };

  const docs: RagDoc[] = [];

  docs.push({
    id: "profile",
    title: "Student Profile",
    text: clip(
      `Career path: ${careerPath}\n` +
        (targetCompany ? `Target company: ${targetCompany}\n` : "") +
        (targetLpa ? `Target LPA: ${targetLpa}\n` : "")
    ),
  });

  if (progress) {
    docs.push({
      id: "roadmap-progress",
      title: "Roadmap Progress",
      text: clip(
        `Unlocked week: ${unlockedWeek}\n` +
          `Completed days count: ${Array.isArray(progress.completedDays) ? progress.completedDays.length : 0}\n` +
          `Weekly tests: ${Array.isArray(progress.weeklyTests) ? progress.weeklyTests.map((t) => `W${t.week}:${t.percentage}%`).join(", ") : ""}`
      ),
    });
  }

  if (plan) {
    docs.push({
      id: "roadmap-week",
      title: `Current Week ${unlockedWeek} Topics`,
      text: clip(weekTopics.length ? weekTopics.join("\n") : "No topics found for current week."),
    });

    docs.push({
      id: "roadmap-week-categories",
      title: `Current Week ${unlockedWeek} By Category`,
      text: clip(
        Object.keys(weekByCategory).length
          ? Object.entries(weekByCategory)
              .map(([cat, topics]) => `${cat.toUpperCase()}:\n- ${(topics as string[]).join("\n- ")}`)
              .join("\n\n")
          : "No categorized topics found for current week."
      ),
    });
  }

  const scoreLines: string[] = [];
  for (const t of ["aptitude", "dsa", "soft_skills", "career"]) {
    const a = latestByType.get(t);
    if (!a) continue;
    scoreLines.push(`${String(t)}: ${Math.round(Number(a.percentage ?? 0))}% (${a.grade ?? ""})`);
  }
  if (scoreLines.length) {
    docs.push({
      id: "assessments",
      title: "Latest Assessment Scores",
      text: clip(scoreLines.join("\n")),
    });
  }

  // Derived guidance doc (helps the model decide what to do today).
  const weakExamTypes = ["aptitude", "dsa", "soft_skills", "career"]
    .map((t) => ({ t, p: Number(latestByType.get(t)?.percentage ?? NaN) }))
    .filter((x) => Number.isFinite(x.p))
    .sort((a, b) => a.p - b.p)
    .slice(0, 2)
    .map((x) => x.t);

  const weakInterview = latestInterview
    ? [
        { t: "communication", s: Number(latestInterview.communicationScore) },
        { t: "dsa", s: Number(latestInterview.dsaScore) },
        { t: "technical", s: Number(latestInterview.technicalScore) },
      ]
        .filter((x) => Number.isFinite(x.s))
        .sort((a, b) => a.s - b.s)
        .slice(0, 1)
        .map((x) => x.t)
    : [];

  docs.push({
    id: "signals",
    title: "Performance Signals (Derived)",
    text: clip(
      `Weakest exams (recent): ${weakExamTypes.length ? weakExamTypes.join(", ") : "unknown"}\n` +
        `Weakest interview dimension (latest): ${weakInterview.length ? weakInterview.join(", ") : "unknown"}\n` +
        `Current week topic count: ${weekTopics.length}`
    ),
  });

  if (latestReq?.requirements) {
    docs.push({
      id: "requirements",
      title: "Latest Role Requirements",
      text: clip(JSON.stringify(latestReq.requirements, null, 2), 1600),
    });
  }

  if (latestInterview) {
    docs.push({
      id: "interview-latest",
      title: "Latest Interview Analysis",
      text: clip(
        `Overall: ${latestInterview.overallScore}/10\n` +
          `Communication: ${latestInterview.communicationScore}/10\n` +
          `DSA: ${latestInterview.dsaScore}/10\n` +
          `Technical: ${latestInterview.technicalScore}/10\n` +
          `Weak topics: ${(latestInterview.answers || [])
            .slice()
            .sort((a: any, b: any) => Number(a.score) - Number(b.score))
            .slice(0, 5)
            .map((a: any) => `${a.topic}(${a.score})`)
            .join(", ")}`
      ),
    });
  }

  return { facts, docs };
}
