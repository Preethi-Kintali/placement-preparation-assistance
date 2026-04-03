import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth";
import { User } from "../models/User";
import { RoadmapProgress } from "../models/RoadmapProgress";
import { generateRoadmap } from "../services/roadmapGenerator";
import { youtubeSearch } from "../services/youtube";
import { groqChat } from "../services/groq";
import { geminiChat } from "../services/gemini";
import { RoadmapPlan } from "../models/RoadmapPlan";
import { RoadmapWeeklyTestSession } from "../models/RoadmapWeeklyTestSession";
import { RoadmapGrandTestSession } from "../models/RoadmapGrandTestSession";
import { Certificate } from "../models/Certificate";
import { getCareerQuestions, getQuestionsForExam, toPublicQuestion } from "../services/questionBank";
import { ExamAttempt } from "../models/ExamAttempt";
import { getOrCreateRoadmapTemplateWeeks } from "../services/roadmapTemplates";
import {
  maybeAwardDailyHealthPoint,
  recordActivity,
  utcDateKey,
  checkAndUnlockRoadmapBadges,
} from "../services/gamification";
import { sendEmailInBackground } from "../services/mailer";

function makeCertificateId(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "CERT-";
  for (let i = 0; i < 10; i++) out += alphabet[Math.floor(Math.random() * alphabet.length)];
  return out;
}

export const roadmapRouter = Router();

function normalizeDsaTopicLabel(raw: string): string {
  const s = String(raw ?? "").trim().toLowerCase();
  const cleaned = s
    .replace(/^dsa\s*[:\-]\s*/i, "")
    .replace(/^dsa\s+/i, "")
    .replace(/\(.*?\)/g, "")
    .trim();

  const map: Array<[RegExp, string]> = [
    [/^arrays?\b/, "Array"],
    [/^strings?\b/, "String Algorithms"],
    [/^linked\s*lists?\b/, "Linked List"],
    [/^stacks?\b/, "Stack"],
    [/^queues?\b/, "Queue"],
    [/^sorting\b/, "Sorting"],
    [/^searching\b/, "Searching"],
    [/^binary\s*search\b/, "Searching"],
    [/^hash\s*table\b/, "Hash Table"],
    [/^greedy\b/, "Greedy"],
    [/^divide\s*and\s*conquer\b/, "Divide and Conquer"],
    [/^trees?\b/, "Tree"],
    [/^bst\b/, "BST"],
    [/^avl\b/, "AVL Tree"],
    [/^heaps?\b/, "Heap"],
    [/^graphs?\b/, "Graph"],
    [/^graph\s*traversal\b/, "Graph Traversal"],
    [/^shortest\s*path\b/, "Shortest Path"],
    [/^mst\b/, "MST"],
    [/^dynamic\s*programming\b/, "Dynamic Programming"],
    [/^dp\b/, "Dynamic Programming"],
    [/^backtracking\b/, "Backtracking"],
    [/^recursion\b/, "Recursion"],
  ];

  for (const [re, label] of map) {
    if (re.test(cleaned)) return label;
  }

  // If it already looks like a dataset label, keep a best-effort title case.
  if (!cleaned) return "Array";
  return cleaned
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

async function requireAssessmentsCompleted(userId: string) {
  const done = await ExamAttempt.distinct("examType", { userId });
  const have = new Set(done.map((t) => String(t)));
  return have.has("aptitude") && have.has("dsa") && have.has("soft_skills") && have.has("career");
}

roadmapRouter.get("/", requireAuth, async (req, res) => {
  const user = await User.findById(req.user!.userId).lean();
  if (!user) return res.status(404).json({ error: "User not found" });

  const ok = await requireAssessmentsCompleted(req.user!.userId);
  if (!ok) return res.status(403).json({ error: "Complete all assessments to unlock the roadmap." });

  const careerPath = user.profile?.career?.careerPath || "Full Stack Developer";

  const progress = await RoadmapProgress.findOneAndUpdate(
    { userId: user._id },
    { $setOnInsert: { userId: user._id, unlockedWeek: 1, completedDays: [], weeklyTests: [] } },
    { upsert: true, new: true }
  ).lean();

  const completed = new Set(progress.completedDays);
  const weeklyTestByWeek = new Map<number, number>();
  for (const t of progress.weeklyTests) weeklyTestByWeek.set(t.week, t.percentage);

  const toGfgResources = (topic: string) => [{ title: "GeeksforGeeks", url: `https://www.geeksforgeeks.org/search/${encodeURIComponent(String(topic ?? "").trim())}` }];
  const normalizeCategory = (c: any) => {
    const s = String(c ?? "").toLowerCase();
    if (s === "aptitude") return "aptitude";
    if (s === "dsa") return "dsa";
    if (s === "softskills" || s === "soft_skills" || s === "soft skills") return "softskills";
    if (s === "tech" || s === "technical") return "tech";
    return "tech";
  };
  const difficultyByWeek = (week: number) => (week <= 4 ? "Beginner" : week <= 8 ? "Intermediate" : "Advanced");

  // Reuse previously generated roadmap as long as careerPath is unchanged.
  const existingPlan = await RoadmapPlan.findOne({ userId: user._id }).lean();
  const shouldRegenerate =
    !existingPlan || existingPlan.careerPath !== careerPath;

  if (!shouldRegenerate && existingPlan) {
    const mappedWeeks = existingPlan.weeks.map((w: any) => {
      const requiredDays = Array.isArray(w.days) && w.days.length ? w.days.length : 7;
      const completedCount = (w.days || []).filter((d: any) => completed.has(`${w.week}-${d.day}`)).length;
      const weekUnlocked = w.week <= progress.unlockedWeek;
      const status = w.week < progress.unlockedWeek ? "completed" : weekUnlocked ? "active" : "locked";
      const lastPct = weeklyTestByWeek.get(w.week);

      const includeTest = Number(w.week) <= 12;

      return {
        week: w.week,
        title: `Week ${w.week}`,
        status,
        days: (w.days || []).map((d: any) => ({
          day: d.day,
          topic: d.topic,
          status: completed.has(`${w.week}-${d.day}`) ? "completed" : "pending",
          resources: toGfgResources(String(d.topic ?? "")),
        })),
        test: includeTest
          ? {
              unlocked: weekUnlocked && completedCount >= requiredDays,
              minPercentToUnlockNextWeek: 60,
              lastPercentage: lastPct,
              requiredDays,
              completedDays: completedCount,
            }
          : null,
      };
    });

    // ── AI Explainability: generation reason ──
    const attempts = await ExamAttempt.find({ userId: user._id }).sort({ createdAt: -1 }).lean();
    const latestByType = new Map<string, any>();
    for (const a of attempts) {
      const k = String((a as any).examType);
      if (!latestByType.has(k)) latestByType.set(k, a);
    }
    const aptitudePct = Math.round(Number(latestByType.get("aptitude")?.percentage ?? 0));
    const dsaPct = Math.round(Number(latestByType.get("dsa")?.percentage ?? 0));
    const softPct = Math.round(Number(latestByType.get("soft_skills")?.percentage ?? 0));
    const careerPct = Math.round(Number(latestByType.get("career")?.percentage ?? 0));

    const reasonParts: string[] = [
      `Generated a ${existingPlan.weeks.length}-week plan for ${careerPath}.`,
    ];
    if (dsaPct < 50) reasonParts.push(`Your DSA score (${dsaPct}%) is weak — extra DSA days included.`);
    if (aptitudePct < 50) reasonParts.push(`Aptitude score (${aptitudePct}%) needs work — aptitude tasks added.`);
    if (softPct < 50) reasonParts.push(`Soft skills score (${softPct}%) is low — communication days added.`);
    if (careerPct >= 70) reasonParts.push(`Strong technical base (${careerPct}%) — more advanced topics included.`);
    reasonParts.push(`You are currently on Week ${progress.unlockedWeek}.`);

    const generationReason = reasonParts.join(" ");

    return res.json({
      careerPath,
      progress: { unlockedWeek: progress.unlockedWeek },
      requirements: existingPlan.requirements,
      weeks: mappedWeeks,
      provider: existingPlan.provider,
      generatedAt: existingPlan.generatedAt,
      generationReason,
      examInfluence: {
        aptitude: aptitudePct,
        dsa: dsaPct,
        softSkills: softPct,
        career: careerPct,
      },
    });
  }

  // Roadmap is deterministic (dataset-driven). We do NOT use Groq to generate it.
  const filteredRequirements: Record<string, unknown> = {
    careerPath,
    generatedFrom: "dataset",
    skills: { technical: [], aptitude: [], dsa: [], softSkills: [] },
  };
  const learnedTopics: string[] = [];

  // Deterministic plan by default (tech-rich, predictable, no external API keys required)
  let provider: "groq" | "gemini" | "deterministic" | "csv" = "deterministic";
  const template = await getOrCreateRoadmapTemplateWeeks(careerPath);
  provider = template.provider;
  let weeks: any[] = template.weeks;

  if (!weeks.length) {
    provider = "csv";
    weeks = await generateRoadmap(careerPath, progress.unlockedWeek, completed, weeklyTestByWeek, new Set());
  }

  const mappedWeeks = weeks.map((w: any) => {
    const requiredDays = Array.isArray(w.days) && w.days.length ? w.days.length : 7;
    const completedCount = (w.days || []).filter((d: any) => completed.has(`${w.week}-${d.day}`)).length;
    const weekUnlocked = w.week <= progress.unlockedWeek;
    const status = w.week < progress.unlockedWeek ? "completed" : weekUnlocked ? "active" : "locked";
    const lastPct = weeklyTestByWeek.get(w.week);

    const includeTest = Number(w.week) <= 12;

    return {
      week: w.week,
      title: `Week ${w.week}`,
      status,
      days: (w.days || []).map((d: any) => ({
        day: d.day,
        topic: d.topic,
        status: completed.has(`${w.week}-${d.day}`) ? "completed" : "pending",
        resources: toGfgResources(String(d.topic ?? "")),
      })),
      test: includeTest
        ? {
            unlocked: weekUnlocked && completedCount >= requiredDays,
            minPercentToUnlockNextWeek: 60,
            lastPercentage: lastPct,
            requiredDays,
            completedDays: completedCount,
          }
        : null,
    };
  });

  // Store the generated roadmap plan for tracking
  await RoadmapPlan.findOneAndUpdate(
    { userId: user._id },
    {
      $set: {
        userId: user._id,
        careerPath,
        provider,
        generatedAt: new Date(),
        requirements: filteredRequirements,
        learnedTopics,
        weeks: weeks.map((w: any) => ({
          week: w.week,
          title: `Week ${w.week}`,
          days: (w.days || []).map((d: any) => ({
            day: d.day,
            topic: String(d.topic ?? ""),
            category: normalizeCategory(d.category),
            difficulty: difficultyByWeek(Number(w.week)),
            resources: toGfgResources(String(d.topic ?? "")),
          })),
        })),
      },
    },
    { upsert: true, new: true }
  ).lean();

  return res.json({
    careerPath,
    progress: { unlockedWeek: progress.unlockedWeek },
    requirements: filteredRequirements,
    weeks: mappedWeeks,
    provider,
  });
});

roadmapRouter.post("/days/complete", requireAuth, async (req, res) => {
  const ok = await requireAssessmentsCompleted(req.user!.userId);
  if (!ok) return res.status(403).json({ error: "Complete all assessments to unlock the roadmap." });

  const schema = z.object({ week: z.number().int().min(1).max(100), day: z.number().int().min(1).max(7) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const key = `${parsed.data.week}-${parsed.data.day}`;

  const existing = await RoadmapProgress.findOne({ userId: req.user!.userId }).select({ completedDays: 1 }).lean();
  if ((existing as any)?.completedDays?.includes(key)) {
    return res.status(409).json({ error: "Day already completed" });
  }

  const progress = await RoadmapProgress.findOneAndUpdate(
    { userId: req.user!.userId },
    { $addToSet: { completedDays: key } },
    { upsert: true, new: true }
  ).lean();

  // Best-effort topic title for timeline (fallback to Week/Day)
  let topic = `Week ${parsed.data.week} Day ${parsed.data.day}`;
  try {
    const plan = await RoadmapPlan.findOne({ userId: req.user!.userId }).lean();
    const week = (plan as any)?.weeks?.find((w: any) => Number(w.week) === Number(parsed.data.week));
    const dayRow = week?.days?.find((d: any) => Number(d.day) === Number(parsed.data.day));
    const t = String(dayRow?.topic ?? "").trim();
    if (t) topic = t;
  } catch {
    // ignore
  }

  await recordActivity({
    userId: req.user!.userId,
    dateKey: utcDateKey(),
    type: "roadmap_day_complete",
    title: `Roadmap: ${topic}`,
    meta: { week: parsed.data.week, day: parsed.data.day, topic },
  });

  // This action can grant today's Health Point (max 1/day)
  const checkIn = await maybeAwardDailyHealthPoint({ userId: req.user!.userId, source: "roadmap_day_complete" });
  const unlockedBadges = await checkAndUnlockRoadmapBadges(req.user!.userId);

  // Optional streak milestone email
  try {
    const u = await User.findById(req.user!.userId).select({ "profile.email": 1, "profile.fullName": 1 }).lean();
    const to = String((u as any)?.profile?.email ?? "").trim();
    if (to && (checkIn as any)?.awarded && (checkIn as any)?.streakMilestone) {
      const milestone = Number((checkIn as any).streakMilestone);
      sendEmailInBackground({
        to,
        subject: `PlacePrep: ${milestone}-day streak milestone!`,
        text:
          `Hi ${(u as any)?.profile?.fullName ?? "Student"},\n\n` +
          `Congrats! You reached a ${milestone}-day streak.\n\n` +
          `Keep it up!\n` +
          `PlacePrep`,
      });
    }
  } catch {
    // ignore
  }

  return res.json({
    ok: true,
    completedDays: progress.completedDays.length,
    checkIn,
    unlockedBadges,
  });
});

// Weekly test (real questions) — must pass to unlock next week.
roadmapRouter.get("/weeks/:week/test", requireAuth, async (req, res) => {
  const ok = await requireAssessmentsCompleted(req.user!.userId);
  if (!ok) return res.status(403).json({ error: "Complete all assessments to unlock the roadmap." });

  const weekParsed = z.coerce.number().int().min(1).max(100).safeParse(req.params.week);
  if (!weekParsed.success) return res.status(400).json({ error: "Invalid week" });
  const week = weekParsed.data;

  const user = await User.findById(req.user!.userId).lean();
  if (!user) return res.status(404).json({ error: "User not found" });
  const careerPath = user.profile?.career?.careerPath || "Full Stack Developer";

  const [progress, plan] = await Promise.all([
    RoadmapProgress.findOne({ userId: user._id }),
    RoadmapPlan.findOne({ userId: user._id }).lean(),
  ]);
  if (!progress) return res.status(404).json({ error: "Progress not found" });
  if (!plan) return res.status(404).json({ error: "Roadmap not found" });

  const maxWeeks = Array.isArray((plan as any).weeks) ? (plan as any).weeks.length : 12;
  if (week > maxWeeks) return res.status(400).json({ error: "Week out of range" });

  if (week > progress.unlockedWeek) return res.status(403).json({ error: "Week is locked" });

  const planWeek = (plan as any).weeks.find((w: any) => w.week === week);
  const dayKeys = (planWeek?.days || []).map((d: any) => `${week}-${d.day}`);
  const completedCount = dayKeys.filter((k: string) => progress.completedDays.includes(k)).length;
  const requiredDays = dayKeys.length || 7;
  if (completedCount < requiredDays) {
    return res.status(403).json({ error: `Complete all ${requiredDays} days to unlock this test` });
  }

  const already = progress.weeklyTests.find((t) => t.week === week && t.passed);
  if (already) return res.status(409).json({ error: "Weekly test already passed" });

  const band = week <= 4 ? "Beginner" : week <= 8 ? "Intermediate" : "Advanced";

  // Build questions: tech-heavy + DSA-heavy + 1 aptitude/soft
  const techCount = 6;
  const dsaCount = 3;
  const miscCount = 1;

  const techRows = await getCareerQuestions(careerPath, techCount, { labelCol: "Level", labelValue: band });

  const weekDays = planWeek?.days || [];
  const dsaTopics = weekDays
    .filter((d: any) => String(d.category) === "dsa")
    .map((d: any) => normalizeDsaTopicLabel(String(d.topic ?? "")))
    .filter(Boolean);

  const dsaRows: any[] = [];
  for (const t of dsaTopics) {
    if (dsaRows.length >= dsaCount) break;
    const want = Math.min(2, dsaCount - dsaRows.length);
    const rows = await getQuestionsForExam("dsa", want, { labelCol: "Topic", labelValue: t });
    dsaRows.push(...rows);
  }
  if (dsaRows.length < dsaCount) {
    const more = await getQuestionsForExam("dsa", dsaCount - dsaRows.length, { labelCol: "Difficulty", labelValue: band });
    dsaRows.push(...more);
  }

  const miscExam: "aptitude" | "soft_skills" = week % 2 === 1 ? "aptitude" : "soft_skills";
  const miscRows =
    miscExam === "soft_skills"
      ? await getQuestionsForExam("soft_skills", miscCount, { labelCol: "Difficulty", labelValue: band })
      : await getQuestionsForExam("aptitude", miscCount);

  const combined = [
    ...techRows.map((r) => ({ row: r, source: "career" as const })),
    ...dsaRows.slice(0, dsaCount).map((r) => ({ row: r, source: "dsa" as const })),
    ...miscRows.slice(0, miscCount).map((r) => ({ row: r, source: miscExam as any })),
  ];

  const session = await RoadmapWeeklyTestSession.create({
    userId: user._id,
    careerPath,
    week,
    questions: combined.map((q) => ({ questionId: String(q.row.id), correctOption: String(q.row.correctOption), source: q.source })),
    expiresAt: new Date(Date.now() + 30 * 60 * 1000),
  });

  return res.json({
    week,
    careerPath,
    minPercentToPass: 60,
    suggestedDurationSeconds: 20 * 60,
    sessionId: String(session._id),
    questions: combined.map((q) => ({ ...toPublicQuestion(q.row), source: q.source })),
  });
});

roadmapRouter.post("/weeks/:week/test/submit", requireAuth, async (req, res) => {
  const ok = await requireAssessmentsCompleted(req.user!.userId);
  if (!ok) return res.status(403).json({ error: "Complete all assessments to unlock the roadmap." });

  const weekParsed = z.coerce.number().int().min(1).max(100).safeParse(req.params.week);
  if (!weekParsed.success) return res.status(400).json({ error: "Invalid week" });
  const week = weekParsed.data;

  const schema = z.object({
    sessionId: z.string().min(1),
    durationSeconds: z.number().int().min(1).max(24 * 60 * 60).optional(),
    answers: z.array(z.object({ questionId: z.string().min(1), selectedOption: z.string().min(1) })).min(1).max(50),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const session = await RoadmapWeeklyTestSession.findOne({ _id: parsed.data.sessionId, userId: req.user!.userId, week });
  if (!session) return res.status(404).json({ error: "Weekly test session not found" });
  if (session.usedAt) return res.status(409).json({ error: "Session already submitted" });
  if (session.expiresAt.getTime() < Date.now()) return res.status(410).json({ error: "Session expired" });

  const correctById = new Map(session.questions.map((q) => [q.questionId, q.correctOption] as const));
  const scored = parsed.data.answers.map((a) => {
    const correctOption = correctById.get(a.questionId) ?? "";
    return {
      questionId: a.questionId,
      selectedOption: a.selectedOption,
      correctOption,
      isCorrect: Boolean(correctOption) && a.selectedOption === correctOption,
    };
  });

  const score = scored.filter((a) => a.isCorrect).length;
  const totalQuestions = scored.length;
  const percentage = (score / totalQuestions) * 100;
  const passed = percentage >= 60;

  session.usedAt = new Date();
  session.durationSeconds = parsed.data.durationSeconds;
  session.answers = scored as any;
  session.score = score;
  session.totalQuestions = totalQuestions;
  session.percentage = percentage;
  session.passed = passed;
  await session.save();

  const progress = await RoadmapProgress.findOne({ userId: req.user!.userId });
  if (!progress) return res.status(404).json({ error: "Progress not found" });

  progress.weeklyTests = progress.weeklyTests.filter((t) => t.week !== week);
  progress.weeklyTests.push({ week, percentage, passed, takenAt: new Date() });

  const plan = await RoadmapPlan.findOne({ userId: req.user!.userId }).lean();
  const maxWeeks = (plan as any)?.weeks?.length ?? 12;
  if (passed && progress.unlockedWeek === week && progress.unlockedWeek < maxWeeks) {
    progress.unlockedWeek += 1;
  }
  await progress.save();

  await recordActivity({
    userId: req.user!.userId,
    dateKey: utcDateKey(),
    type: "weekly_test_completed",
    title: `Weekly test completed (Week ${week})`,
    meta: { week, percentage, passed, score, totalQuestions },
  });

  // Optional email notification
  try {
    const u = await User.findById(req.user!.userId).select({ "profile.email": 1, "profile.fullName": 1 }).lean();
    const to = String((u as any)?.profile?.email ?? "").trim();
    if (to) {
      sendEmailInBackground({
        to,
        subject: `PlacePrep: Weekly test completed (Week ${week})`,
        text:
          `Hi ${(u as any)?.profile?.fullName ?? "Student"},\n\n` +
          `Weekly test result (Week ${week}):\n` +
          `Score: ${score}/${totalQuestions} (${Math.round(percentage)}%)\n` +
          `Status: ${passed ? "PASSED ✅" : "NOT PASSED"}\n\n` +
          `PlacePrep`,
      });
    }
  } catch {
    // ignore
  }

  return res.json({ ok: true, week, score, totalQuestions, percentage, passed, unlockedWeek: progress.unlockedWeek });
});

function requireGrandTestUnlocked(progress: any, plan: any) {
  const weeks = Array.isArray(plan?.weeks) ? plan.weeks : [];
  const first12 = weeks.filter((w: any) => Number(w.week) >= 1 && Number(w.week) <= 12);
  if (first12.length < 12) {
    return { ok: false as const, error: "Roadmap must have 12 weeks before taking the grand test." };
  }

  // Must complete all days in weeks 1..12
  for (let week = 1; week <= 12; week++) {
    const wk = first12.find((w: any) => Number(w.week) === week);
    const dayKeys = (wk?.days || []).map((d: any) => `${week}-${d.day}`);
    const requiredDays = dayKeys.length || 7;
    const completedCount = dayKeys.filter((k: string) => (progress.completedDays || []).includes(k)).length;
    if (completedCount < requiredDays) {
      return { ok: false as const, error: `Complete Week ${week} (all ${requiredDays} days) to unlock the grand test.` };
    }
  }

  // Must pass all weekly tests 1..12
  const passedWeeks = new Set((progress.weeklyTests || []).filter((t: any) => t?.passed).map((t: any) => Number(t.week)));
  for (let week = 1; week <= 12; week++) {
    if (!passedWeeks.has(week)) {
      return { ok: false as const, error: `Pass Week ${week} test to unlock the grand test.` };
    }
  }

  return { ok: true as const };
}

// Grand test after week 12 — pass >= 50% to get certificate
roadmapRouter.get("/grand-test", requireAuth, async (req, res) => {
  const ok = await requireAssessmentsCompleted(req.user!.userId);
  if (!ok) return res.status(403).json({ error: "Complete all assessments to unlock the roadmap." });

  const user = await User.findById(req.user!.userId).lean();
  if (!user) return res.status(404).json({ error: "User not found" });
  const careerPath = user.profile?.career?.careerPath || "Full Stack Developer";

  const [progress, plan] = await Promise.all([
    RoadmapProgress.findOne({ userId: user._id }).lean(),
    RoadmapPlan.findOne({ userId: user._id }).lean(),
  ]);
  if (!progress) return res.status(404).json({ error: "Progress not found" });
  if (!plan) return res.status(404).json({ error: "Roadmap not found" });

  const unlocked = requireGrandTestUnlocked(progress, plan);
  if (!unlocked.ok) return res.status(403).json({ error: unlocked.error });

  const existingCert = await Certificate.findOne({ userId: user._id }).lean();
  if (existingCert) {
    return res.json({
      unlocked: true,
      alreadyCertified: true,
      certificate: { certificateId: existingCert.certificateId, percentage: existingCert.percentage, issuedAt: existingCert.issuedAt },
    });
  }

  const alreadyAttempt = await RoadmapGrandTestSession.findOne({ userId: user._id, usedAt: { $exists: true } })
    .sort({ createdAt: -1 })
    .lean();
  if (alreadyAttempt?.passed) {
    // Safety: if a passed attempt exists but certificate missing, issue it.
    const cert = await Certificate.create({
      userId: user._id,
      careerPath,
      certificateId: makeCertificateId(),
      percentage: Number(alreadyAttempt.percentage ?? 0),
      issuedAt: new Date(),
    });
    return res.json({
      unlocked: true,
      alreadyCertified: true,
      certificate: { certificateId: cert.certificateId, percentage: cert.percentage, issuedAt: cert.issuedAt },
    });
  }

  const band = "Advanced";
  const techCount = 12;
  const dsaCount = 10;
  const aptitudeCount = 4;
  const softCount = 4;

  const [techRows, dsaRows, aptitudeRows, softRows] = await Promise.all([
    getCareerQuestions(careerPath, techCount, { labelCol: "Level", labelValue: band }),
    getQuestionsForExam("dsa", dsaCount, { labelCol: "Difficulty", labelValue: band }),
    getQuestionsForExam("aptitude", aptitudeCount),
    getQuestionsForExam("soft_skills", softCount, { labelCol: "Difficulty", labelValue: band }),
  ]);

  const combined = [
    ...techRows.slice(0, techCount).map((r) => ({ row: r, source: "career" as const })),
    ...dsaRows.slice(0, dsaCount).map((r) => ({ row: r, source: "dsa" as const })),
    ...aptitudeRows.slice(0, aptitudeCount).map((r) => ({ row: r, source: "aptitude" as const })),
    ...softRows.slice(0, softCount).map((r) => ({ row: r, source: "soft_skills" as const })),
  ];

  const session = await RoadmapGrandTestSession.create({
    userId: user._id,
    careerPath,
    questions: combined.map((q) => ({ questionId: String(q.row.id), correctOption: String(q.row.correctOption), source: q.source })),
    expiresAt: new Date(Date.now() + 45 * 60 * 1000),
  });

  return res.json({
    unlocked: true,
    minPercentToPass: 50,
    suggestedDurationSeconds: 30 * 60,
    sessionId: String(session._id),
    questions: combined.map((q) => ({ ...toPublicQuestion(q.row), source: q.source })),
  });
});

roadmapRouter.post("/grand-test/submit", requireAuth, async (req, res) => {
  const ok = await requireAssessmentsCompleted(req.user!.userId);
  if (!ok) return res.status(403).json({ error: "Complete all assessments to unlock the roadmap." });

  const schema = z.object({
    sessionId: z.string().min(1),
    durationSeconds: z.number().int().min(1).max(24 * 60 * 60).optional(),
    answers: z.array(z.object({ questionId: z.string().min(1), selectedOption: z.string().min(1) })).min(1).max(100),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const user = await User.findById(req.user!.userId).lean();
  if (!user) return res.status(404).json({ error: "User not found" });

  const session = await RoadmapGrandTestSession.findOne({ _id: parsed.data.sessionId, userId: user._id });
  if (!session) return res.status(404).json({ error: "Grand test session not found" });
  if (session.usedAt) return res.status(409).json({ error: "Session already submitted" });
  if (session.expiresAt.getTime() < Date.now()) return res.status(410).json({ error: "Session expired" });

  const correctById = new Map(session.questions.map((q) => [q.questionId, q.correctOption] as const));
  const scored = parsed.data.answers.map((a) => {
    const correctOption = correctById.get(a.questionId) ?? "";
    return {
      questionId: a.questionId,
      selectedOption: a.selectedOption,
      correctOption,
      isCorrect: Boolean(correctOption) && a.selectedOption === correctOption,
    };
  });

  const score = scored.filter((a) => a.isCorrect).length;
  const totalQuestions = scored.length;
  const percentage = (score / totalQuestions) * 100;
  const passed = percentage >= 50;

  session.usedAt = new Date();
  session.durationSeconds = parsed.data.durationSeconds;
  session.answers = scored as any;
  session.score = score;
  session.totalQuestions = totalQuestions;
  session.percentage = percentage;
  session.passed = passed;
  await session.save();

  let certificate: any = null;
  if (passed) {
    const careerPath = user.profile?.career?.careerPath || "Full Stack Developer";
    const existing = await Certificate.findOne({ userId: user._id });
    if (!existing) {
      const created = await Certificate.create({
        userId: user._id,
        careerPath,
        certificateId: makeCertificateId(),
        percentage,
        issuedAt: new Date(),
      });
      certificate = { certificateId: created.certificateId, percentage: created.percentage, issuedAt: created.issuedAt };
    } else {
      certificate = { certificateId: existing.certificateId, percentage: existing.percentage, issuedAt: existing.issuedAt };
    }
  }

  await recordActivity({
    userId: req.user!.userId,
    dateKey: utcDateKey(),
    type: "grand_test_completed",
    title: passed ? "Grand test passed" : "Grand test completed",
    meta: { percentage, passed, score, totalQuestions },
  });

  // Optional email notification
  try {
    const to = String((user as any)?.profile?.email ?? "").trim();
    if (to) {
      sendEmailInBackground({
        to,
        subject: `PlacePrep: Grand test ${passed ? "passed" : "completed"}`,
        text:
          `Hi ${(user as any)?.profile?.fullName ?? "Student"},\n\n` +
          `Grand test result:\n` +
          `Score: ${score}/${totalQuestions} (${Math.round(percentage)}%)\n` +
          `Status: ${passed ? "PASSED ✅" : "COMPLETED"}\n` +
          `${certificate ? `\nCertificate ID: ${certificate.certificateId}\n` : ""}` +
          `\nPlacePrep`,
      });
    }
  } catch {
    // ignore
  }

  return res.json({ ok: true, score, totalQuestions, percentage, passed, certificate });
});

roadmapRouter.get("/certificate", requireAuth, async (req, res) => {
  const ok = await requireAssessmentsCompleted(req.user!.userId);
  if (!ok) return res.status(403).json({ error: "Complete all assessments to unlock the roadmap." });

  const cert = await Certificate.findOne({ userId: req.user!.userId }).lean();
  if (!cert) return res.status(404).json({ error: "Certificate not found" });
  return res.json({
    certificateId: cert.certificateId,
    careerPath: cert.careerPath,
    percentage: cert.percentage,
    issuedAt: cert.issuedAt,
  });
});

// "Check for new tech" — uses Groq only to suggest missing tech, then appends as extra weeks after Week 12.
roadmapRouter.post("/check-new-tech", requireAuth, async (req, res) => {
  const ok = await requireAssessmentsCompleted(req.user!.userId);
  if (!ok) return res.status(403).json({ error: "Complete all assessments to unlock the roadmap." });

  const user = await User.findById(req.user!.userId).lean();
  if (!user) return res.status(404).json({ error: "User not found" });
  const careerPath = user.profile?.career?.careerPath || "Full Stack Developer";

  const plan = await RoadmapPlan.findOne({ userId: user._id });
  if (!plan) return res.status(404).json({ error: "Roadmap not found" });

  const existingTopics = new Set(
    (plan.weeks || []).flatMap((w: any) => (w.days || []).map((d: any) => String(d.topic ?? "").toLowerCase()))
  );

  const currentYear = new Date().getFullYear();

  const prompt =
    `Today is ${currentYear}. Suggest up to 12 NEW or trending technologies/tools/frameworks for a ${careerPath} ` +
    `that are relevant in ${currentYear} and NOT already in this list: ${JSON.stringify(Array.from(existingTopics).slice(0, 200))}.\n` +
    `Return JSON ONLY: {"newTech": string[]}. Keep items short like "Next.js App Router", "React Server Components", "Bun", "tRPC".`;

  let newTech: string[] = [];
  try {
    const raw = await groqChat(prompt);
    const parsed = JSON.parse(raw);
    if (Array.isArray((parsed as any)?.newTech)) {
      newTech = (parsed as any).newTech.map((s: any) => String(s ?? "").trim()).filter(Boolean);
    }
  } catch (e: any) {
    return res.status(502).json({ error: "Groq check failed", details: String(e?.message ?? e) });
  }

  const missing = newTech.filter((t) => {
    const k = t.toLowerCase();
    for (const existing of existingTopics) {
      if (existing.includes(k) || k.includes(existing)) return false;
    }
    return true;
  });

  if (!missing.length) {
    return res.json({ ok: true, added: 0, weeksAppended: 0, missing: [] });
  }

  const toGfgResources = (topic: string) => [{ title: "GeeksforGeeks", url: `https://www.geeksforgeeks.org/search/${encodeURIComponent(String(topic ?? "").trim())}` }];
  const currentMax = Math.max(...(plan.weeks || []).map((w: any) => Number(w.week) || 0), 12);
  const startWeek = currentMax + 1;

  const chunks: string[][] = [];
  for (let i = 0; i < missing.length; i += 7) chunks.push(missing.slice(i, i + 7));

  const appended = chunks.map((topics, idx) => {
    const week = startWeek + idx;
    return {
      week,
      title: `Week ${week}`,
      days: topics.map((t, i) => ({
        day: i + 1,
        topic: t,
        category: "tech",
        difficulty: "Advanced",
        resources: toGfgResources(t),
      })),
    };
  });

  plan.weeks = [...(plan.weeks as any), ...(appended as any)];
  plan.generatedAt = new Date();
  await plan.save();

  return res.json({ ok: true, added: missing.length, weeksAppended: appended.length, missing });
});

roadmapRouter.get("/resources", requireAuth, async (req, res) => {
  const ok = await requireAssessmentsCompleted(req.user!.userId);
  if (!ok) return res.status(403).json({ error: "Complete all assessments to unlock the roadmap." });

  const q = z.object({ topic: z.string().min(2), maxResults: z.coerce.number().int().min(1).max(3).default(1) }).safeParse(req.query);
  if (!q.success) return res.status(400).json({ error: q.error.flatten() });

  try {
    const { videos, source } = await youtubeSearch(q.data.topic, q.data.maxResults);
    return res.json({ topic: q.data.topic, videos, source });
  } catch (e: any) {
    const status = typeof e?.status === "number" ? e.status : undefined;
    const body = e?.body;
    const details = body
      ? body
      : {
          message: String(e?.message ?? e),
          status,
        };
    return res.status(502).json({ error: "YouTube API error", details });
  }
});

roadmapRouter.post("/topic-info", requireAuth, async (req, res) => {
  const ok = await requireAssessmentsCompleted(req.user!.userId);
  if (!ok) return res.status(403).json({ error: "Complete all assessments to unlock the roadmap." });

  const parsed = z.object({ topic: z.string().min(2).max(120) }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const topic = parsed.data.topic.trim();
  const prompt =
    `Explain the topic "${topic}" for an Indian engineering student preparing for placements.\n` +
    `Return plain text with these sections:\n` +
    `1) What it is (2-3 lines)\n` +
    `2) Key points (5 bullets)\n` +
    `3) Mini example (short)\n` +
    `4) 2 interview questions\n` +
    `Keep it concise and practical. No markdown tables.`;

  const [groq, gemini] = await Promise.allSettled([
    groqChat(prompt),
    geminiChat(prompt),
  ]);

  const groqOut =
    groq.status === "fulfilled"
      ? { ok: true, text: groq.value }
      : { ok: false, error: String((groq.reason as any)?.message ?? groq.reason ?? "Groq error") };
  const geminiOut =
    gemini.status === "fulfilled"
      ? { ok: true, text: gemini.value }
      : { ok: false, error: String((gemini.reason as any)?.message ?? gemini.reason ?? "Gemini error") };

  return res.json({ topic, groq: groqOut, gemini: geminiOut });
});
