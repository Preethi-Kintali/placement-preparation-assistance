/**
 * ═══════════════════════════════════════════════════════════════════
 *  PERSONALIZATION ENGINE — Skill Gap Analysis & Adaptive Insights
 * ═══════════════════════════════════════════════════════════════════
 */

import { User } from "../models/User";
import { ExamAttempt } from "../models/ExamAttempt";
import { RoadmapPlan } from "../models/RoadmapPlan";
import { RoadmapProgress } from "../models/RoadmapProgress";
import { InterviewSession } from "../models/InterviewSession";

// ── Required Skills by Career Path ────────────────────────────────

const CAREER_SKILLS: Record<string, { core: string[]; recommended: string[] }> = {
    "Full Stack Developer": {
        core: ["HTML/CSS", "JavaScript", "React", "Node.js", "SQL", "Git", "REST APIs"],
        recommended: ["TypeScript", "Docker", "AWS", "MongoDB", "GraphQL", "CI/CD"],
    },
    "Data Scientist": {
        core: ["Python", "Statistics", "Machine Learning", "SQL", "Pandas", "NumPy"],
        recommended: ["TensorFlow", "Deep Learning", "NLP", "Data Visualization", "R", "Spark"],
    },
    "ML Engineer": {
        core: ["Python", "Machine Learning", "Deep Learning", "TensorFlow/PyTorch", "SQL", "Math"],
        recommended: ["MLOps", "Docker", "Kubernetes", "Feature Engineering", "Model Deployment"],
    },
    "Cybersecurity Engineer": {
        core: ["Networking", "Linux", "Security Tools", "Cryptography", "Firewalls", "Penetration Testing"],
        recommended: ["SIEM", "Cloud Security", "Incident Response", "Python", "Compliance"],
    },
    "DevOps Engineer": {
        core: ["Linux", "Docker", "Kubernetes", "CI/CD", "Cloud (AWS/GCP/Azure)", "Git"],
        recommended: ["Terraform", "Ansible", "Monitoring", "Python/Bash", "Microservices"],
    },
    "Mobile Developer": {
        core: ["React Native/Flutter", "JavaScript/Dart", "REST APIs", "Mobile UI/UX", "Git"],
        recommended: ["Native (Swift/Kotlin)", "Firebase", "State Management", "App Store Deployment"],
    },
    "AI Engineer": {
        core: ["Python", "Machine Learning", "Deep Learning", "NLP", "LLMs", "Math"],
        recommended: ["RAG", "Prompt Engineering", "Vector Databases", "LangChain", "Fine-tuning"],
    },
    "GenAI Developer": {
        core: ["Python", "LLMs", "Prompt Engineering", "RAG", "API Integration", "NLP"],
        recommended: ["LangChain", "Vector Databases", "Fine-tuning", "Embeddings", "Agents"],
    },
    "Data Analyst": {
        core: ["SQL", "Excel", "Python/R", "Data Visualization", "Statistics", "Business Intelligence"],
        recommended: ["Tableau", "Power BI", "A/B Testing", "ETL", "Communication"],
    },
    "Blockchain Developer": {
        core: ["Solidity", "Ethereum", "Smart Contracts", "Cryptography", "Web3.js", "DeFi"],
        recommended: ["Rust", "Layer 2", "NFTs", "Security Auditing", "Node.js"],
    },
    "IoT Developer": {
        core: ["Embedded C", "Arduino/Raspberry Pi", "Sensors", "MQTT", "Networking", "Python"],
        recommended: ["Edge Computing", "Cloud IoT", "PCB Design", "RTOS", "Data Analytics"],
    },
};

export type SkillStatus = "strong" | "moderate" | "weak" | "missing";

export interface SkillGap {
    skill: string;
    status: SkillStatus;
    category: "core" | "recommended";
    evidence?: string;
}

export interface PersonalizationInsight {
    skillGaps: SkillGap[];
    strongAreas: string[];
    weakAreas: string[];
    dailyTasks: DailyTask[];
    adaptiveInsights: string[];
    overallReadiness: number; // 0-100
}

export interface DailyTask {
    title: string;
    type: "study" | "practice" | "exam" | "interview" | "project";
    priority: "high" | "medium" | "low";
    estimatedMinutes: number;
    reason: string;
}

// ── Skill Gap Analyzer ────────────────────────────────────────────

export async function analyzeSkillGap(userId: string): Promise<PersonalizationInsight> {
    const [user, attempts, plan, progress, interviews] = await Promise.all([
        User.findById(userId).lean(),
        ExamAttempt.find({ userId }).sort({ createdAt: -1 }).lean(),
        RoadmapPlan.findOne({ userId }).lean(),
        RoadmapProgress.findOne({ userId }).lean(),
        InterviewSession.find({ userId }).sort({ completedAt: -1 }).limit(5).lean(),
    ]);

    const profile = (user as any)?.profile;
    const careerPath = profile?.career?.careerPath || "Full Stack Developer";
    const technologies = profile?.experience?.technologies || [];

    // Get required skills for career
    const careerSkills = CAREER_SKILLS[careerPath] || CAREER_SKILLS["Full Stack Developer"];

    // Get latest scores
    const latestByType = new Map<string, any>();
    for (const a of attempts) {
        const key = String((a as any).examType);
        if (!latestByType.has(key)) latestByType.set(key, a);
    }

    const aptitudeScore = Number(latestByType.get("aptitude")?.percentage ?? 0);
    const dsaScore = Number(latestByType.get("dsa")?.percentage ?? 0);
    const softSkillsScore = Number(latestByType.get("soft_skills")?.percentage ?? 0);
    const careerScore = Number(latestByType.get("career")?.percentage ?? 0);

    // Analyze skill gaps
    const techSet = new Set(technologies.map((t: string) => t.toLowerCase()));
    const skillGaps: SkillGap[] = [];
    const strongAreas: string[] = [];
    const weakAreas: string[] = [];

    function checkSkill(skill: string, category: "core" | "recommended"): SkillGap {
        const hasSkill = techSet.has(skill.toLowerCase()) ||
            technologies.some((t: string) => skill.toLowerCase().includes(t.toLowerCase()) || t.toLowerCase().includes(skill.toLowerCase()));

        if (hasSkill) {
            strongAreas.push(skill);
            return { skill, status: "strong", category, evidence: "Listed in profile" };
        }
        return { skill, status: "missing", category };
    }

    for (const skill of careerSkills.core) {
        skillGaps.push(checkSkill(skill, "core"));
    }
    for (const skill of careerSkills.recommended) {
        skillGaps.push(checkSkill(skill, "recommended"));
    }

    // Add exam-based gaps
    if (aptitudeScore > 0 && aptitudeScore < 60) weakAreas.push("Aptitude");
    else if (aptitudeScore >= 75) strongAreas.push("Aptitude");

    if (dsaScore > 0 && dsaScore < 60) weakAreas.push("DSA");
    else if (dsaScore >= 75) strongAreas.push("DSA");

    if (softSkillsScore > 0 && softSkillsScore < 60) weakAreas.push("Soft Skills");
    else if (softSkillsScore >= 75) strongAreas.push("Soft Skills");

    if (careerScore > 0 && careerScore < 60) weakAreas.push("Career Technical");
    else if (careerScore >= 75) strongAreas.push("Career Technical");

    // Add interview-based gaps
    if (interviews.length > 0) {
        const latest = interviews[0] as any;
        if (latest.communicationScore < 5) weakAreas.push("Interview Communication");
        if (latest.dsaScore < 5) weakAreas.push("Interview DSA");
        if (latest.technicalScore < 5) weakAreas.push("Interview Technical");
    }

    // Generate daily tasks
    const dailyTasks: DailyTask[] = [];

    if (weakAreas.includes("DSA") || dsaScore < 60) {
        dailyTasks.push({
            title: "Practice 3 DSA problems on LeetCode",
            type: "practice",
            priority: "high",
            estimatedMinutes: 45,
            reason: `Your DSA score is ${dsaScore > 0 ? Math.round(dsaScore) + "%" : "not tested yet"}`,
        });
    }

    if (weakAreas.includes("Aptitude") || aptitudeScore < 60) {
        dailyTasks.push({
            title: "Solve 10 aptitude questions",
            type: "practice",
            priority: "high",
            estimatedMinutes: 30,
            reason: `Your aptitude score is ${aptitudeScore > 0 ? Math.round(aptitudeScore) + "%" : "not tested yet"}`,
        });
    }

    const missingCore = skillGaps.filter((g) => g.status === "missing" && g.category === "core");
    if (missingCore.length > 0) {
        dailyTasks.push({
            title: `Study ${missingCore[0].skill} — core skill for ${careerPath}`,
            type: "study",
            priority: "high",
            estimatedMinutes: 60,
            reason: `${missingCore[0].skill} is a core requirement missing from your profile`,
        });
    }

    if (interviews.length < 3) {
        dailyTasks.push({
            title: "Complete an AI mock interview session",
            type: "interview",
            priority: "medium",
            estimatedMinutes: 20,
            reason: `You've only completed ${interviews.length} interview(s). Practice makes perfect!`,
        });
    }

    if (weakAreas.includes("Soft Skills") || softSkillsScore < 60) {
        dailyTasks.push({
            title: "Watch a communication skills video & practice",
            type: "study",
            priority: "medium",
            estimatedMinutes: 20,
            reason: `Soft skills need improvement (${softSkillsScore > 0 ? Math.round(softSkillsScore) + "%" : "not tested"})`,
        });
    }

    // Roadmap check
    const completedDays = (progress as any)?.completedDays?.length ?? 0;
    const unlockedWeek = (progress as any)?.unlockedWeek ?? 1;
    if (plan && completedDays > 0) {
        dailyTasks.push({
            title: `Continue roadmap — Week ${unlockedWeek}`,
            type: "study",
            priority: "medium",
            estimatedMinutes: 45,
            reason: `You've completed ${completedDays} roadmap days so far`,
        });
    }

    // Generate adaptive insights
    const adaptiveInsights: string[] = [];

    if (dsaScore > 0 && aptitudeScore > 0) {
        if (dsaScore < aptitudeScore - 20) {
            adaptiveInsights.push(
                `Your DSA score (${Math.round(dsaScore)}%) is significantly lower than your aptitude (${Math.round(aptitudeScore)}%). Focus more time on Data Structures & Algorithms.`
            );
        }
        if (aptitudeScore < dsaScore - 20) {
            adaptiveInsights.push(
                `Your aptitude score (${Math.round(aptitudeScore)}%) is lagging behind DSA (${Math.round(dsaScore)}%). Practice quantitative problems daily.`
            );
        }
    }

    if (missingCore.length >= 3) {
        adaptiveInsights.push(
            `${missingCore.length} core skills for ${careerPath} are missing from your profile. Prioritize learning: ${missingCore.slice(0, 3).map((g) => g.skill).join(", ")}.`
        );
    }

    if (interviews.length > 0) {
        const avgInterview = interviews.reduce((s, i: any) => s + (i.overallScore || 0), 0) / interviews.length;
        if (avgInterview < 5) {
            adaptiveInsights.push(
                `Your average interview score is ${avgInterview.toFixed(1)}/10. Focus on structured answers (STAR method) and practice regularly.`
            );
        }
    }

    // Calculate overall readiness (0-100)
    const coreFoundPercent = skillGaps.filter((g) => g.category === "core" && g.status === "strong").length / Math.max(1, careerSkills.core.length);
    const examAvg = [aptitudeScore, dsaScore, softSkillsScore, careerScore].filter((s) => s > 0);
    const examAvgScore = examAvg.length > 0 ? examAvg.reduce((a, b) => a + b, 0) / examAvg.length : 0;
    const interviewAvg = interviews.length > 0
        ? (interviews.reduce((s, i: any) => s + (i.overallScore || 0), 0) / interviews.length) * 10
        : 0;

    const overallReadiness = Math.round(
        (coreFoundPercent * 30) + (examAvgScore * 0.4) + (interviewAvg * 0.3)
    );

    return {
        skillGaps,
        strongAreas: [...new Set(strongAreas)],
        weakAreas: [...new Set(weakAreas)],
        dailyTasks: dailyTasks.slice(0, 6),
        adaptiveInsights,
        overallReadiness: Math.min(100, Math.max(0, overallReadiness)),
    };
}
