import { Router } from "express";
import { requireAuth, requireRole } from "../middleware/auth";
import { User } from "../models/User";
import { ExamAttempt } from "../models/ExamAttempt";
import { RequirementSnapshot } from "../models/RequirementSnapshot";
import { groqRequirements } from "../services/groq";
import { RoadmapPlan } from "../models/RoadmapPlan";
import { RoadmapProgress } from "../models/RoadmapProgress";
import { RoadmapWeeklyTestSession } from "../models/RoadmapWeeklyTestSession";
import { RoadmapGrandTestSession } from "../models/RoadmapGrandTestSession";
import { Certificate } from "../models/Certificate";
import { getPlacementModel } from "../services/placementModel";
import { InterviewSession } from "../models/InterviewSession";

export const adminRouter = Router();

adminRouter.get("/stats", requireAuth, requireRole("admin"), async (_req, res) => {
  const [students, admins, attempts] = await Promise.all([
    User.countDocuments({ role: "student" }),
    User.countDocuments({ role: "admin" }),
    ExamAttempt.countDocuments({}),
  ]);

  return res.json({ students, admins, attempts });
});

adminRouter.get("/students", requireAuth, requireRole("admin"), async (_req, res) => {
  const students = await User.find({ role: "student" })
    .select({ studentId: 1, profile: 1, createdAt: 1 })
    .lean();

  const ids = students.map((s) => s._id);
  const snapshots = await RequirementSnapshot.find({ userId: { $in: ids } })
    .sort({ generatedAt: -1 })
    .lean();

  const latestByUser = new Map<string, any>();
  for (const snap of snapshots) {
    const key = String(snap.userId);
    if (!latestByUser.has(key)) latestByUser.set(key, snap);
  }

  const result = students.map((s) => ({
    id: String(s._id),
    studentId: s.studentId,
    profile: s.profile,
    createdAt: s.createdAt,
    latestRequirements: latestByUser.get(String(s._id))?.requirements ?? null,
  }));

  return res.json({ students: result });
});

adminRouter.post("/requirements/:userId", requireAuth, requireRole("admin"), async (req, res) => {
  const user = await User.findById(req.params.userId).lean();
  if (!user) return res.status(404).json({ error: "User not found" });

  const careerPath = user.profile.career.careerPath || "Full Stack Developer";
  const requirements = await groqRequirements(careerPath);

  const snap = await RequirementSnapshot.create({
    userId: user._id,
    careerPath,
    generatedAt: new Date(),
    requirements,
  });

  return res.json({ id: String(snap._id), requirements });
});

adminRouter.get("/students/:userId/roadmap", requireAuth, requireRole("admin"), async (req, res) => {
  const user = await User.findById(req.params.userId)
    .select({ studentId: 1, role: 1, profile: 1 })
    .lean();
  if (!user) return res.status(404).json({ error: "User not found" });
  if (user.role !== "student") return res.status(400).json({ error: "Roadmap is only available for students" });

  const [plan, progress] = await Promise.all([
    RoadmapPlan.findOne({ userId: user._id }).lean(),
    RoadmapProgress.findOne({ userId: user._id }).lean(),
  ]);

  return res.json({
    student: { id: String(user._id), studentId: user.studentId, profile: user.profile },
    roadmap: plan,
    progress,
  });
});

adminRouter.get("/students/:userId/results", requireAuth, requireRole("admin"), async (req, res) => {
  const user = await User.findById(req.params.userId)
    .select({ studentId: 1, role: 1, profile: 1 })
    .lean();
  if (!user) return res.status(404).json({ error: "User not found" });
  if (user.role !== "student") return res.status(400).json({ error: "Results are only available for students" });

  const [attempts, progress, weeklySessions, grandSessions, cert, interviewSessions] = await Promise.all([
    ExamAttempt.find({ userId: user._id }).sort({ createdAt: -1 }).lean(),
    RoadmapProgress.findOne({ userId: user._id }).lean(),
    RoadmapWeeklyTestSession.find({ userId: user._id, usedAt: { $exists: true } }).sort({ week: 1, createdAt: -1 }).lean(),
    RoadmapGrandTestSession.find({ userId: user._id, usedAt: { $exists: true } }).sort({ createdAt: -1 }).lean(),
    Certificate.findOne({ userId: user._id }).lean(),
    InterviewSession.find({ userId: user._id }).sort({ completedAt: -1 }).limit(20).lean(),
  ]);

  return res.json({
    student: { id: String(user._id), studentId: user.studentId, profile: user.profile },
    exams: attempts.map((a: any) => ({
      id: String(a._id),
      examType: a.examType,
      score: a.score,
      totalQuestions: a.totalQuestions,
      percentage: a.percentage,
      grade: a.grade,
      createdAt: a.createdAt,
    })),
    roadmapProgress: progress
      ? {
          unlockedWeek: progress.unlockedWeek,
          completedDaysCount: Array.isArray(progress.completedDays) ? progress.completedDays.length : 0,
          weeklyTests: progress.weeklyTests || [],
        }
      : null,
    weeklyTests: weeklySessions.map((s: any) => ({
      id: String(s._id),
      week: s.week,
      percentage: s.percentage,
      passed: s.passed,
      score: s.score,
      totalQuestions: s.totalQuestions,
      usedAt: s.usedAt,
    })),
    grandTests: grandSessions.map((s: any) => ({
      id: String(s._id),
      percentage: s.percentage,
      passed: s.passed,
      score: s.score,
      totalQuestions: s.totalQuestions,
      usedAt: s.usedAt,
    })),
    certificate: cert
      ? {
          certificateId: cert.certificateId,
          careerPath: cert.careerPath,
          percentage: cert.percentage,
          issuedAt: cert.issuedAt,
        }
      : null,
    interviewSessions: (interviewSessions || []).map((s: any) => ({
      id: String(s._id),
      currentWeek: s.currentWeek,
      topics: s.topics || [],
      overallScore: s.overallScore,
      communicationScore: s.communicationScore,
      dsaScore: s.dsaScore,
      technicalScore: s.technicalScore,
      durationSeconds: s.durationSeconds,
      completedAt: s.completedAt,
    })),
  });
});

adminRouter.get("/ml/placement-report", requireAuth, requireRole("admin"), async (_req, res) => {
  const model = await getPlacementModel();
  return res.json({
    algorithm: model.algorithm,
    trainedAt: model.trainedAt,
    sampleCount: model.sampleCount,
    trainAccuracyPct: Math.round((model.trainAccuracy ?? 0) * 10000) / 100,
    holdoutAccuracyPct: Math.round((model.accuracy ?? 0) * 10000) / 100,
    holdoutAuc: Math.round((model.holdoutAuc ?? 0) * 10000) / 10000,
    confusionMatrix: model.confusionMatrix,
    featureImportance: (model.featureImportance || []).map((f) => ({
      feature: f.feature,
      aucDrop: Math.round((f.aucDrop ?? 0) * 100000) / 100000,
    })),
  });
});
