import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth";
import { DailyActivity } from "../models/DailyActivity";
import { ActivityEvent } from "../models/ActivityEvent";
import { ExamAttempt } from "../models/ExamAttempt";
import { InterviewSession } from "../models/InterviewSession";
import { RoadmapProgress } from "../models/RoadmapProgress";
import { RoadmapPlan } from "../models/RoadmapPlan";
import { User } from "../models/User";
import {
  BADGES,
  computeDisplayStreak,
  diffUtcDays,
  maybeAwardDailyHealthPoint,
  recordActivity,
  utcDateKey,
} from "../services/gamification";
import { sendEmail } from "../services/mailer";

export const activityRouter = Router();

const dailyLearningSchema = z.object({ text: z.string().min(3).max(240) });
const newTechSchema = z.object({ tech: z.string().min(2).max(60) });

activityRouter.post("/daily-learning", requireAuth, async (req, res) => {
  const parsed = dailyLearningSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const text = parsed.data.text.trim();
  const dateKey = utcDateKey();

  await recordActivity({
    userId: req.user!.userId,
    dateKey,
    type: "daily_learning",
    title: "Daily check-in: What did you learn today?",
    meta: { text },
  });

  const checkIn = await maybeAwardDailyHealthPoint({ userId: req.user!.userId, source: "daily_learning", dateKey });

  // Optional streak milestone email
  try {
    if ((checkIn as any)?.awarded && (checkIn as any)?.streakMilestone) {
      const u = await User.findById(req.user!.userId).select({ "profile.email": 1, "profile.fullName": 1 }).lean();
      const to = String((u as any)?.profile?.email ?? "").trim();
      if (to) {
        const milestone = Number((checkIn as any).streakMilestone);
        await sendEmail({
          to,
          subject: `PlacePrep: ${milestone}-day streak milestone!`,
          text:
            `Hi ${(u as any)?.profile?.fullName ?? "Student"},\n\n` +
            `Congrats! You reached a ${milestone}-day streak.\n\n` +
            `Keep it up!\n` +
            `PlacePrep`,
        });
      }
    }
  } catch {
    // ignore
  }

  return res.json({ ok: true, checkIn });
});

// Manual 'new tech learned' entry (does not affect daily health point by default).
activityRouter.post("/new-tech", requireAuth, async (req, res) => {
  const parsed = newTechSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const tech = parsed.data.tech.trim();
  const dateKey = utcDateKey();

  await recordActivity({
    userId: req.user!.userId,
    dateKey,
    type: "new_tech_learned",
    title: `New tech learned: ${tech}`,
    meta: { tech },
  });

  return res.json({ ok: true });
});

activityRouter.get("/summary", requireAuth, async (req, res) => {
  const user = await User.findById(req.user!.userId).lean();
  if (!user) return res.status(404).json({ error: "User not found" });

  const nowKey = utcDateKey();
  const g = computeDisplayStreak((user as any).gamification ?? { healthPoints: 0, currentStreak: 0, longestStreak: 0, badges: [] }, nowKey);
  const todayCheckedIn = String(g.lastCheckInDate ?? "") === nowKey;

  // Heatmap: last 365 days
  const since = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);
  const sinceKey = utcDateKey(since);
  const days = await DailyActivity.find({ userId: req.user!.userId, dateKey: { $gte: sinceKey } })
    .select({ _id: 0, dateKey: 1, count: 1, byType: 1 })
    .lean();

  // Timeline events
  const events = await ActivityEvent.find({ userId: req.user!.userId })
    .sort({ createdAt: -1 })
    .limit(60)
    .lean();

  // Stats summary
  const [examAttempts, interviewCount, progress, plan] = await Promise.all([
    ExamAttempt.find({ userId: req.user!.userId }).select({ percentage: 1 }).lean(),
    InterviewSession.countDocuments({ userId: req.user!.userId }),
    RoadmapProgress.findOne({ userId: req.user!.userId }).lean(),
    RoadmapPlan.findOne({ userId: req.user!.userId }).lean(),
  ]);

  const totalExamsCompleted = examAttempts.length;
  const averageScore = totalExamsCompleted
    ? Math.round((examAttempts.reduce((s: number, a: any) => s + (Number(a.percentage) || 0), 0) / totalExamsCompleted) * 10) / 10
    : 0;

  const completedDays = (progress as any)?.completedDays?.length ?? 0;
  let totalDays = 84;
  const weeks = (plan as any)?.weeks ?? [];
  if (Array.isArray(weeks) && weeks.length) {
    totalDays = weeks.reduce((sum: number, w: any) => sum + ((w?.days?.length as number) || 0), 0) || totalDays;
  }
  const roadmapProgressPercent = totalDays ? Math.round((completedDays / totalDays) * 1000) / 10 : 0;

  return res.json({
    ok: true,
    today: { dateKey: nowKey, checkedIn: todayCheckedIn },
    gamification: g,
    badges: {
      all: BADGES,
      unlocked: g.badges ?? [],
    },
    heatmap: {
      sinceKey,
      days,
    },
    timeline: {
      events: events.map((e: any) => ({
        id: String(e._id),
        type: e.type,
        title: e.title,
        dateKey: e.dateKey,
        createdAt: e.createdAt,
        meta: e.meta ?? {},
      })),
    },
    stats: {
      totalExamsCompleted,
      averageScore,
      roadmapProgressPercent,
      interviewSessionsCompleted: interviewCount,
    },
  });
});

// Global leaderboard (top 50), filter by career track.
activityRouter.get("/leaderboard", requireAuth, async (req, res) => {
  const careerPath = String(req.query.careerPath ?? "").trim();
  const nowKey = utcDateKey();

  const match: any = { role: "student" };
  if (careerPath) match["profile.career.careerPath"] = careerPath;

  // Keep it simple + deterministic: compute a composite score.
  const pipeline: any[] = [
    { $match: match },
    {
      $project: {
        studentId: 1,
        profile: 1,
        gamification: 1,
      },
    },
    {
      $lookup: {
        from: "examattempts",
        localField: "_id",
        foreignField: "userId",
        as: "attempts",
      },
    },
    {
      $lookup: {
        from: "roadmapprogresses",
        localField: "_id",
        foreignField: "userId",
        as: "roadmapProgress",
      },
    },
    {
      $lookup: {
        from: "roadmapplans",
        localField: "_id",
        foreignField: "userId",
        as: "roadmapPlan",
      },
    },
    {
      $lookup: {
        from: "interviewsessions",
        localField: "_id",
        foreignField: "userId",
        as: "interviews",
      },
    },
    {
      $addFields: {
        avgScore: {
          $cond: [
            { $gt: [{ $size: "$attempts" }, 0] },
            { $avg: "$attempts.percentage" },
            0,
          ],
        },
        examsCount: { $size: "$attempts" },
        interviewCount: { $size: "$interviews" },
        completedDays: {
          $let: {
            vars: { p: { $arrayElemAt: ["$roadmapProgress", 0] } },
            in: { $size: { $ifNull: ["$$p.completedDays", []] } },
          },
        },
        totalDays: {
          $let: {
            vars: { plan: { $arrayElemAt: ["$roadmapPlan", 0] } },
            in: {
              $cond: [
                { $gt: [{ $size: { $ifNull: ["$$plan.weeks", []] } }, 0] },
                {
                  $sum: {
                    $map: {
                      input: "$$plan.weeks",
                      as: "w",
                      in: { $size: { $ifNull: ["$$w.days", []] } },
                    },
                  },
                },
                84,
              ],
            },
          },
        },
      },
    },
    {
      $addFields: {
        roadmapPercent: {
          $cond: [
            { $gt: ["$totalDays", 0] },
            { $multiply: [{ $divide: ["$completedDays", "$totalDays"] }, 100] },
            0,
          ],
        },
        compositeScore: {
          $add: [
            { $multiply: [{ $ifNull: ["$gamification.healthPoints", 0] }, 10] },
            { $multiply: [{ $ifNull: ["$gamification.currentStreak", 0] }, 5] },
            { $multiply: ["$avgScore", 1] },
            { $multiply: ["$roadmapPercent", 1.5] },
            { $multiply: ["$interviewCount", 2] },
          ],
        },
      },
    },
    { $sort: { compositeScore: -1, "gamification.healthPoints": -1, "gamification.currentStreak": -1, avgScore: -1 } },
    { $limit: 50 },
  ];

  const rows = await User.aggregate(pipeline);
  const meId = String(req.user!.userId);

  return res.json({
    ok: true,
    careerPath: careerPath || null,
    rows: rows.map((r: any, idx: number) => {
      const last = String(r.gamification?.lastCheckInDate ?? "");
      const stored = Number(r.gamification?.currentStreak ?? 0);
      const displayStreak = last && diffUtcDays(last, nowKey) >= 2 ? 0 : stored;
      return {
      rank: idx + 1,
      userId: String(r._id),
      isMe: String(r._id) === meId,
      name: r.profile?.fullName ?? "Student",
      avatarUrl: r.profile?.avatarUrl ?? "",
      college: r.profile?.education?.collegeName ?? "",
      careerPath: r.profile?.career?.careerPath ?? "",
      healthPoints: Number(r.gamification?.healthPoints ?? 0),
      currentStreak: displayStreak,
      longestStreak: Number(r.gamification?.longestStreak ?? 0),
      averageScore: Math.round(Number(r.avgScore || 0) * 10) / 10,
      roadmapProgressPercent: Math.round(Number(r.roadmapPercent || 0) * 10) / 10,
      interviewCount: Number(r.interviewCount || 0),
      };
    }),
  });
});
