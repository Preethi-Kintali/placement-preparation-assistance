import { User, type BadgeId, type GamificationProfile } from "../models/User";
import { DailyActivity, type ActivityType } from "../models/DailyActivity";
import { ActivityEvent } from "../models/ActivityEvent";
import { ExamAttempt } from "../models/ExamAttempt";
import { InterviewSession } from "../models/InterviewSession";
import { RoadmapPlan } from "../models/RoadmapPlan";
import { RoadmapProgress } from "../models/RoadmapProgress";

function pad2(n: number) {
  return n < 10 ? `0${n}` : String(n);
}

export function utcDateKey(d = new Date()): string {
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
}

export function parseUtcDateKey(key: string): Date {
  const [y, m, day] = String(key).split("-").map((x) => Number(x));
  return new Date(Date.UTC(y || 1970, (m || 1) - 1, day || 1));
}

export function diffUtcDays(aKey: string, bKey: string): number {
  const a = parseUtcDateKey(aKey);
  const b = parseUtcDateKey(bKey);
  const ms = b.getTime() - a.getTime();
  return Math.round(ms / (24 * 60 * 60 * 1000));
}

export const BADGES: Array<{ id: BadgeId; title: string; description: string }> = [
  { id: "streak_7", title: "7 Day Streak", description: "Maintain a 7 day check-in streak." },
  { id: "streak_30", title: "30 Day Streak", description: "Maintain a 30 day check-in streak." },
  { id: "streak_120", title: "120 Day Streak", description: "Maintain a 120 day check-in streak." },
  { id: "first_exam", title: "First Exam Completed", description: "Complete your first exam." },
  { id: "score_90", title: "90%+ Score", description: "Score 90% or higher in an exam." },
  { id: "full_roadmap", title: "Roadmap Completed", description: "Complete every roadmap day." },
  { id: "interview_5", title: "5 Interview Attempts", description: "Complete 5 interview sessions." },
];

function hasBadge(g: GamificationProfile | undefined, id: BadgeId): boolean {
  return Boolean(g?.badges?.some((b) => b.id === id));
}

async function unlockBadge(userId: string, id: BadgeId): Promise<boolean> {
  const user = await User.findById(userId);
  if (!user) return false;
  if (hasBadge(user.gamification, id)) return false;
  user.gamification.badges.push({ id, unlockedAt: new Date() } as any);
  await user.save();
  return true;
}

export async function recordActivity(input: {
  userId: string;
  dateKey?: string;
  type: ActivityType;
  title: string;
  meta?: Record<string, unknown>;
}): Promise<void> {
  const dateKey = input.dateKey ?? utcDateKey();

  await Promise.all([
    DailyActivity.findOneAndUpdate(
      { userId: input.userId, dateKey },
      {
        $inc: {
          count: 1,
          [`byType.${input.type}`]: 1,
        },
        $setOnInsert: {
          userId: input.userId,
          dateKey,
        },
      },
      { upsert: true, new: false }
    ),
    ActivityEvent.create({
      userId: input.userId,
      dateKey,
      type: input.type,
      title: input.title,
      meta: input.meta,
      createdAt: new Date(),
    }),
  ]);
}

export function computeDisplayStreak(g: GamificationProfile, nowKey = utcDateKey()): GamificationProfile {
  const last = String(g.lastCheckInDate ?? "").trim();
  if (!last) return g;
  const delta = diffUtcDays(last, nowKey);
  if (delta >= 2) {
    return { ...g, currentStreak: 0 };
  }
  return g;
}

export async function maybeAwardDailyHealthPoint(input: {
  userId: string;
  // Only these sources count toward the daily health point.
  source: "daily_learning" | "roadmap_day_complete";
  dateKey?: string;
}): Promise<{
  awarded: boolean;
  gamification: GamificationProfile;
  unlockedBadges: BadgeId[];
  streakMilestone?: 7 | 30 | 120;
}> {
  const dateKey = input.dateKey ?? utcDateKey();
  const user = await User.findById(input.userId);
  if (!user) throw new Error("User not found");

  const g = user.gamification ?? ({ healthPoints: 0, currentStreak: 0, longestStreak: 0, badges: [] } as any);

  // If already awarded today, do nothing.
  if (String(g.lastCheckInDate ?? "") === dateKey) {
    const display = computeDisplayStreak(g, dateKey);
    return { awarded: false, gamification: display, unlockedBadges: [] };
  }

  // Determine streak update based on last check-in day.
  const lastKey = String(g.lastCheckInDate ?? "").trim();
  let nextStreak = 1;
  if (lastKey) {
    const delta = diffUtcDays(lastKey, dateKey);
    if (delta === 1) nextStreak = Math.max(0, Number(g.currentStreak || 0)) + 1;
    else nextStreak = 1;
  }

  user.gamification.healthPoints = Math.max(0, Number(g.healthPoints || 0)) + 1;
  user.gamification.currentStreak = nextStreak;
  user.gamification.longestStreak = Math.max(Number(g.longestStreak || 0), nextStreak);
  user.gamification.lastCheckInDate = dateKey;
  await user.save();

  const unlockedBadges: BadgeId[] = [];
  let streakMilestone: 7 | 30 | 120 | undefined;
  if (nextStreak >= 7 && !hasBadge(user.gamification, "streak_7")) {
    const ok = await unlockBadge(input.userId, "streak_7");
    if (ok) unlockedBadges.push("streak_7");
    streakMilestone = 7;
  }
  if (nextStreak >= 30 && !hasBadge(user.gamification, "streak_30")) {
    const ok = await unlockBadge(input.userId, "streak_30");
    if (ok) unlockedBadges.push("streak_30");
    streakMilestone = 30;
  }
  if (nextStreak >= 120 && !hasBadge(user.gamification, "streak_120")) {
    const ok = await unlockBadge(input.userId, "streak_120");
    if (ok) unlockedBadges.push("streak_120");
    streakMilestone = 120;
  }

  const freshUser = await User.findById(input.userId).lean();
  const freshG = (freshUser as any)?.gamification ?? user.gamification;
  return { awarded: true, gamification: computeDisplayStreak(freshG, dateKey), unlockedBadges, streakMilestone };
}

export async function checkAndUnlockExamBadges(userId: string, percentage: number): Promise<BadgeId[]> {
  const unlocked: BadgeId[] = [];
  const count = await ExamAttempt.countDocuments({ userId });
  if (count === 1) {
    if (await unlockBadge(userId, "first_exam")) unlocked.push("first_exam");
  }
  if (percentage >= 90) {
    if (await unlockBadge(userId, "score_90")) unlocked.push("score_90");
  }
  return unlocked;
}

export async function checkAndUnlockInterviewBadges(userId: string): Promise<BadgeId[]> {
  const unlocked: BadgeId[] = [];
  const count = await InterviewSession.countDocuments({ userId });
  if (count >= 5) {
    if (await unlockBadge(userId, "interview_5")) unlocked.push("interview_5");
  }
  return unlocked;
}

export async function checkAndUnlockRoadmapBadges(userId: string): Promise<BadgeId[]> {
  const unlocked: BadgeId[] = [];
  const [progress, plan] = await Promise.all([
    RoadmapProgress.findOne({ userId }).lean(),
    RoadmapPlan.findOne({ userId }).lean(),
  ]);

  const completedCount = (progress as any)?.completedDays?.length ?? 0;
  let totalDays = 84;
  const weeks = (plan as any)?.weeks ?? [];
  if (Array.isArray(weeks) && weeks.length) {
    totalDays = weeks.reduce((sum: number, w: any) => sum + ((w?.days?.length as number) || 0), 0) || totalDays;
  }

  if (totalDays > 0 && completedCount >= totalDays) {
    if (await unlockBadge(userId, "full_roadmap")) unlocked.push("full_roadmap");
  }

  return unlocked;
}
