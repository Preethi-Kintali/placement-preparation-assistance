/**
 * ═══════════════════════════════════════════════════════════════════
 *  SMART ALERT ENGINE — Automated Notification Triggers
 * ═══════════════════════════════════════════════════════════════════
 */

import { Alert, type AlertType, type AlertSeverity } from "../models/Alert";
import { User } from "../models/User";
import { ExamAttempt } from "../models/ExamAttempt";
import { RoadmapPlan } from "../models/RoadmapPlan";
import { RoadmapProgress } from "../models/RoadmapProgress";
import { predictPlacementProbability } from "./placementModel";

// Avoid duplicate alerts within this window
const ALERT_COOLDOWN_HOURS = 24;

async function hasRecentAlert(userId: string, type: AlertType): Promise<boolean> {
    const cutoff = new Date(Date.now() - ALERT_COOLDOWN_HOURS * 60 * 60 * 1000);
    const count = await Alert.countDocuments({
        userId,
        type,
        createdAt: { $gte: cutoff },
    });
    return count > 0;
}

async function createAlert(input: {
    userId: string;
    type: AlertType;
    title: string;
    message: string;
    severity: AlertSeverity;
    metadata?: Record<string, unknown>;
}): Promise<boolean> {
    if (await hasRecentAlert(input.userId, input.type)) return false;

    await Alert.create({
        userId: input.userId,
        type: input.type,
        title: input.title,
        message: input.message,
        severity: input.severity,
        read: false,
        metadata: input.metadata,
    });
    return true;
}

// ── Check: Roadmap Behind ─────────────────────────────────────────

async function checkRoadmapBehind(userId: string): Promise<void> {
    const [plan, progress] = await Promise.all([
        RoadmapPlan.findOne({ userId }).lean(),
        RoadmapProgress.findOne({ userId }).lean(),
    ]);

    if (!plan || !progress) return;

    const weeks = (plan as any)?.weeks ?? [];
    const totalDays = weeks.reduce(
        (sum: number, w: any) => sum + ((w?.days?.length as number) || 0),
        0
    );
    const completedDays = (progress as any)?.completedDays?.length ?? 0;

    // Calculate expected progress based on plan creation date
    const planCreated = (plan as any)?.createdAt;
    if (!planCreated) return;

    const daysSinceCreation = Math.floor(
        (Date.now() - new Date(planCreated).getTime()) / (24 * 60 * 60 * 1000)
    );
    const expectedDays = Math.min(daysSinceCreation, totalDays);
    const behindBy = expectedDays - completedDays;

    if (behindBy >= 5) {
        await createAlert({
            userId,
            type: "roadmap_behind",
            title: "⚠️ Falling Behind Roadmap",
            message: `You're ${behindBy} days behind your study plan. You've completed ${completedDays}/${totalDays} days. Try to catch up to stay on track!`,
            severity: "warning",
            metadata: { behindBy, completedDays, totalDays },
        });
    } else if (behindBy >= 3) {
        await createAlert({
            userId,
            type: "roadmap_behind",
            title: "📋 Roadmap Reminder",
            message: `You're ${behindBy} days behind schedule. Keep going — consistency is key!`,
            severity: "info",
            metadata: { behindBy, completedDays, totalDays },
        });
    }
}

// ── Check: Weak Subjects ──────────────────────────────────────────

async function checkWeakSubjects(userId: string): Promise<void> {
    const attempts = await ExamAttempt.find({ userId })
        .sort({ createdAt: -1 })
        .lean();

    const latestByType = new Map<string, any>();
    for (const a of attempts) {
        const key = String((a as any).examType);
        if (!latestByType.has(key)) latestByType.set(key, a);
    }

    for (const [examType, attempt] of latestByType) {
        const percentage = Number(attempt.percentage ?? 0);
        if (percentage < 40) {
            await createAlert({
                userId,
                type: "weak_subject",
                title: `🔴 Weak Area: ${examType.replace("_", " ").toUpperCase()}`,
                message: `Your latest ${examType.replace("_", " ")} score is ${Math.round(percentage)}%. Focus extra time on this area to improve your placement chances.`,
                severity: "critical",
                metadata: { examType, percentage },
            });
        } else if (percentage < 60) {
            await createAlert({
                userId,
                type: "weak_subject",
                title: `🟡 Needs Improvement: ${examType.replace("_", " ").toUpperCase()}`,
                message: `Your ${examType.replace("_", " ")} score is ${Math.round(percentage)}%. A bit more practice can push this up significantly.`,
                severity: "warning",
                metadata: { examType, percentage },
            });
        }
    }
}

// ── Check: Streak ─────────────────────────────────────────────────

async function checkStreakRisk(userId: string): Promise<void> {
    const user = await User.findById(userId).lean();
    if (!user) return;

    const g = (user as any).gamification;
    if (!g?.lastCheckInDate) return;

    const lastDate = new Date(g.lastCheckInDate);
    const hoursSince = (Date.now() - lastDate.getTime()) / (60 * 60 * 1000);

    if (g.currentStreak >= 3 && hoursSince >= 20 && hoursSince < 48) {
        await createAlert({
            userId,
            type: "streak_broken",
            title: `🔥 ${g.currentStreak}-Day Streak at Risk!`,
            message: `You haven't checked in today. Don't lose your ${g.currentStreak}-day streak — do at least one activity!`,
            severity: "warning",
            metadata: { currentStreak: g.currentStreak, hoursSince: Math.round(hoursSince) },
        });
    }
}

// ── Main: Run All Checks ──────────────────────────────────────────

export async function runAlertChecks(userId: string): Promise<number> {
    let alertCount = 0;

    try {
        const beforeCount = await Alert.countDocuments({ userId, read: false });

        await Promise.allSettled([
            checkRoadmapBehind(userId),
            checkWeakSubjects(userId),
            checkStreakRisk(userId),
        ]);

        const afterCount = await Alert.countDocuments({ userId, read: false });
        alertCount = afterCount - beforeCount;
    } catch (err) {
        console.error("[AlertEngine] Error running checks:", err);
    }

    return alertCount;
}

// ── Get Alerts ────────────────────────────────────────────────────

export async function getUserAlerts(
    userId: string,
    options?: { unreadOnly?: boolean; limit?: number }
): Promise<any[]> {
    const filter: Record<string, any> = { userId };
    if (options?.unreadOnly) filter.read = false;

    return Alert.find(filter)
        .sort({ createdAt: -1 })
        .limit(options?.limit ?? 20)
        .lean();
}

export async function getUnreadCount(userId: string): Promise<number> {
    return Alert.countDocuments({ userId, read: false });
}

export async function markAlertRead(alertId: string, userId: string): Promise<boolean> {
    const result = await Alert.updateOne(
        { _id: alertId, userId },
        { $set: { read: true } }
    );
    return result.modifiedCount > 0;
}

export async function markAllRead(userId: string): Promise<number> {
    const result = await Alert.updateMany(
        { userId, read: false },
        { $set: { read: true } }
    );
    return result.modifiedCount;
}
