import { Router } from "express";
import { z } from "zod";

import { requireAuth } from "../middleware/auth";
import { ExamAttempt } from "../models/ExamAttempt";
import { getCareerQuestions, getQuestionsForExam, toPublicQuestion } from "../services/questionBank";
import { computeGrade } from "../services/grading";
import { User } from "../models/User";
import { ExamSession } from "../models/ExamSession";

export const examRouter = Router();

const examTypeSchema = z.enum(["aptitude", "dsa", "soft_skills", "career"]);

examRouter.get("/status", requireAuth, async (req, res) => {
  const attempts = await ExamAttempt.find({ userId: req.user!.userId })
    .sort({ createdAt: -1 })
    .lean();

  const latestByType = new Map<string, any>();
  for (const a of attempts) {
    if (!latestByType.has(a.examType)) latestByType.set(a.examType, a);
  }

  const aptitudeDone = latestByType.has("aptitude");
  const dsaDone = latestByType.has("dsa");
  const softDone = latestByType.has("soft_skills");

  return res.json({
    aptitude: { unlocked: true, latest: latestByType.get("aptitude") || null },
    dsa: { unlocked: aptitudeDone, latest: latestByType.get("dsa") || null },
    soft_skills: { unlocked: aptitudeDone && dsaDone, latest: latestByType.get("soft_skills") || null },
    career: { unlocked: aptitudeDone && dsaDone && softDone, latest: latestByType.get("career") || null },
  });
});

examRouter.get("/career/questions", requireAuth, async (req, res) => {
  const querySchema = z.object({
    count: z.coerce.number().int().min(1).max(50).default(15),
    labelCol: z.string().optional(),
    labelValue: z.string().optional(),
  });

  const q = querySchema.safeParse(req.query);
  if (!q.success) return res.status(400).json({ error: q.error.flatten() });

  const user = await User.findById(req.user!.userId).lean();
  if (!user) return res.status(404).json({ error: "User not found" });

  const careerPath = user.profile?.career?.careerPath || "Full Stack Developer";
  const rows = await getCareerQuestions(careerPath, q.data.count, {
    labelCol: q.data.labelCol,
    labelValue: q.data.labelValue,
  });

  const session = await ExamSession.create({
    userId: req.user!.userId,
    examType: "career",
    questions: rows.map((r) => ({ questionId: r.id, correctOption: r.correctOption })),
    expiresAt: new Date(Date.now() + 30 * 60 * 1000),
  });

  return res.json({
    examType: "career",
    careerPath,
    suggestedDurationSeconds: 15 * 60,
    count: rows.length,
    sessionId: String(session._id),
    questions: rows.map(toPublicQuestion),
  });
});

examRouter.get("/:examType/questions", requireAuth, async (req, res) => {
  const examTypeParsed = examTypeSchema.safeParse(req.params.examType);
  if (!examTypeParsed.success) return res.status(400).json({ error: "Invalid examType" });

  const examType = examTypeParsed.data;
  if (examType === "career") {
    return res.status(400).json({ error: "Use /api/exams/career/questions" });
  }

  const querySchema = z.object({
    count: z.coerce.number().int().min(1).max(50).default(15),
    labelCol: z.string().optional(),
    labelValue: z.string().optional(),
  });

  const q = querySchema.safeParse(req.query);
  if (!q.success) return res.status(400).json({ error: q.error.flatten() });

  const rows = await getQuestionsForExam(examType, q.data.count, {
    labelCol: q.data.labelCol,
    labelValue: q.data.labelValue,
  });

  const session = await ExamSession.create({
    userId: req.user!.userId,
    examType,
    questions: rows.map((r) => ({ questionId: r.id, correctOption: r.correctOption })),
    expiresAt: new Date(Date.now() + 30 * 60 * 1000),
  });

  return res.json({
    examType,
    suggestedDurationSeconds: 15 * 60,
    count: rows.length,
    sessionId: String(session._id),
    questions: rows.map(toPublicQuestion),
  });
});

const submitSchema = z.object({
  examType: examTypeSchema,
  sessionId: z.string().min(1),
  durationSeconds: z.number().int().min(1).max(24 * 60 * 60).optional(),
  answers: z
    .array(
      z.object({
        questionId: z.string().min(1),
        selectedOption: z.string().min(1),
      })
    )
    .min(1)
    .max(50),
});

examRouter.post("/submit", requireAuth, async (req, res) => {
  const parsed = submitSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const { examType, sessionId, answers, durationSeconds } = parsed.data;

  const session = await ExamSession.findOne({ _id: sessionId, userId: req.user!.userId, examType });
  if (!session) return res.status(404).json({ error: "Exam session not found" });
  if (session.usedAt) return res.status(409).json({ error: "Session already submitted" });
  if (session.expiresAt.getTime() < Date.now()) return res.status(410).json({ error: "Session expired" });

  const correctById = new Map(session.questions.map((q) => [q.questionId, q.correctOption] as const));
  const scored = answers.map((a) => {
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
  const grade = computeGrade(percentage);

  session.usedAt = new Date();
  await session.save();

  const attempt = await ExamAttempt.create({
    userId: req.user!.userId,
    examType,
    totalQuestions,
    score,
    percentage,
    grade,
    durationSeconds,
    answers: scored,
  });

  return res.status(201).json({
    id: String(attempt._id),
    examType,
    score,
    totalQuestions,
    percentage,
    grade,
    answers: scored,
  });
});
