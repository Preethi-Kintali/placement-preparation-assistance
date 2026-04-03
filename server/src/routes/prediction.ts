import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import { User } from "../models/User";
import { ExamAttempt } from "../models/ExamAttempt";
import { getPlacementModel, predictPlacementProbability, type PlacementFeatures } from "../services/placementModel";
import { InterviewSession } from "../models/InterviewSession";

export const predictionRouter = Router();

function pctToSoftSkillRating(pct: number): number {
  const p = Math.max(0, Math.min(100, pct));
  return 1 + (p / 100) * 4;
}

predictionRouter.get("/placement", requireAuth, async (req, res) => {
  const user = await User.findById(req.user!.userId).lean();
  if (!user) return res.status(404).json({ error: "User not found" });

  const attempts = await ExamAttempt.find({ userId: user._id })
    .sort({ createdAt: -1 })
    .lean();

  const latestByType = new Map<string, any>();
  for (const a of attempts) {
    const k = String((a as any).examType);
    if (!latestByType.has(k)) latestByType.set(k, a);
  }

  const aptitudePct = Number(latestByType.get("aptitude")?.percentage ?? 0);
  const softPct = Number(latestByType.get("soft_skills")?.percentage ?? 0);

  const education = (user as any).profile?.education ?? {};
  const experience = (user as any).profile?.experience ?? {};

  const cgpa = Number(education?.btechCgpa ?? 0);
  const projects = Number(experience?.projectCount ?? 0);
  const internshipsRaw = Number(experience?.internshipsCount ?? NaN);
  const internships = Number.isFinite(internshipsRaw) ? internshipsRaw : experience?.hasInternship ? 1 : 0;

  const workshopsRaw = Number(experience?.workshopsCertificationsCount ?? NaN);
  const workshopsCertifications = Number.isFinite(workshopsRaw)
    ? workshopsRaw
    : Array.isArray(experience?.technologies)
      ? Math.min(10, Math.ceil(experience.technologies.length / 3))
      : 0;

  const sscMarks = Number(education?.tenthPercent ?? 0);
  const hscMarks = Number(education?.twelfthPercent ?? 0);

  const allAssessmentsDone = Boolean(latestByType.get("aptitude") && latestByType.get("dsa") && latestByType.get("soft_skills") && latestByType.get("career"));

  const features: PlacementFeatures = {
    cgpa: Number.isFinite(cgpa) ? cgpa : 0,
    internships,
    projects: Number.isFinite(projects) ? projects : 0,
    workshopsCertifications,
    aptitudeTestScore: Number.isFinite(aptitudePct) ? aptitudePct : 0,
    softSkillsRating: pctToSoftSkillRating(Number.isFinite(softPct) ? softPct : 0),
    extracurricularActivities: 0,
    placementTraining: allAssessmentsDone ? 1 : 0,
    sscMarks: Number.isFinite(sscMarks) ? sscMarks : 0,
    hscMarks: Number.isFinite(hscMarks) ? hscMarks : 0,
  };

  const model = await getPlacementModel();
  const prediction = await predictPlacementProbability(features);
  const baseProbabilityPct = Math.round(prediction.probability * 100);

  const latestInterview = await InterviewSession.findOne({ userId: user._id })
    .sort({ completedAt: -1 })
    .lean();

  const interviewOverall = Number(latestInterview?.overallScore ?? 0);
  const interviewCommunication = Number(latestInterview?.communicationScore ?? 0);
  const interviewDsa = Number(latestInterview?.dsaScore ?? 0);
  const interviewTechnical = Number(latestInterview?.technicalScore ?? 0);

  let interviewDelta = 0;
  if (latestInterview) {
    if (interviewOverall >= 8.5) interviewDelta += 6;
    else if (interviewOverall >= 7.5) interviewDelta += 3;
    else if (interviewOverall < 6) interviewDelta -= 6;

    if (interviewCommunication < 6) interviewDelta -= 2;
    if (interviewDsa < 6) interviewDelta -= 2;
    if (interviewTechnical < 6) interviewDelta -= 2;
  }

  const probabilityPct = Math.max(0, Math.min(100, baseProbabilityPct + interviewDelta));

  // Minimal “other things to do” checklist (separate from tech/aptitude/dsa/soft skills)
  const checklist = [
    "Build 2–3 strong projects (deployed + GitHub)",
    "Resume: one-page, ATS-friendly, quantified impact",
    "LinkedIn + GitHub: consistent branding and pinned projects",
    "Mock interviews: 3+ (tech + HR)",
    "Applications: weekly targets + tracking sheet",
  ];

  if (latestInterview) {
    if (interviewCommunication < 7) {
      checklist.unshift("Improve communication: use STAR structure, concise explanations, and 2 timed mock HR rounds weekly");
    }
    if (interviewDsa < 7) {
      checklist.unshift("Improve DSA communication: explain approach, complexity, and edge cases before coding");
    }
    if (interviewTechnical < 7) {
      checklist.unshift("Improve technical depth: include trade-offs, scalability constraints, and production considerations");
    }
  } else {
    checklist.unshift("Take at least 1 AI mock interview to benchmark communication and DSA performance");
  }

  // ── AI EXPLAINABILITY ──────────────────────────────────────

  // Feature importance from model
  const featureImportance = (model.featureImportance || []).map((fi) => ({
    feature: fi.feature,
    importance: Math.round(fi.aucDrop * 1000) / 1000,
    importancePct: Math.round(fi.aucDrop * 100),
  }));

  // Analyze top positive and negative factors
  const topPositiveFactors: Array<{ factor: string; value: string; impact: string }> = [];
  const topNegativeFactors: Array<{ factor: string; value: string; impact: string }> = [];

  if (features.cgpa >= 7.5) topPositiveFactors.push({ factor: "CGPA", value: `${features.cgpa}`, impact: "Strong academic foundation" });
  else if (features.cgpa < 6 && features.cgpa > 0) topNegativeFactors.push({ factor: "CGPA", value: `${features.cgpa}`, impact: "Below competitive threshold" });

  if (features.internships >= 2) topPositiveFactors.push({ factor: "Internships", value: `${features.internships}`, impact: "Good practical experience" });
  else if (features.internships === 0) topNegativeFactors.push({ factor: "Internships", value: "0", impact: "No industry exposure" });

  if (features.projects >= 3) topPositiveFactors.push({ factor: "Projects", value: `${features.projects}`, impact: "Strong portfolio" });
  else if (features.projects <= 1) topNegativeFactors.push({ factor: "Projects", value: `${features.projects}`, impact: "Need more projects" });

  if (features.aptitudeTestScore >= 70) topPositiveFactors.push({ factor: "Aptitude", value: `${Math.round(features.aptitudeTestScore)}%`, impact: "Good problem-solving" });
  else if (features.aptitudeTestScore < 50 && features.aptitudeTestScore > 0) topNegativeFactors.push({ factor: "Aptitude", value: `${Math.round(features.aptitudeTestScore)}%`, impact: "Needs improvement" });

  if (features.sscMarks >= 80) topPositiveFactors.push({ factor: "10th Marks", value: `${Math.round(features.sscMarks)}%`, impact: "Strong academics" });
  if (features.hscMarks >= 80) topPositiveFactors.push({ factor: "12th Marks", value: `${Math.round(features.hscMarks)}%`, impact: "Strong academics" });

  if (features.workshopsCertifications >= 3) topPositiveFactors.push({ factor: "Certifications", value: `${features.workshopsCertifications}`, impact: "Active learner" });

  if (latestInterview) {
    if (interviewOverall >= 7.5) topPositiveFactors.push({ factor: "Interview Score", value: `${interviewOverall.toFixed(1)}/10`, impact: "Strong interview performance" });
    else if (interviewOverall < 5) topNegativeFactors.push({ factor: "Interview Score", value: `${interviewOverall.toFixed(1)}/10`, impact: "Weak interview performance" });
  } else {
    topNegativeFactors.push({ factor: "Mock Interview", value: "Not taken", impact: "No interview practice recorded" });
  }

  // Generate natural language explanation
  const explanationParts: string[] = [];
  explanationParts.push(`Your placement probability is ${probabilityPct}%.`);

  if (topPositiveFactors.length > 0) {
    explanationParts.push(
      `Strengths: ${topPositiveFactors.slice(0, 3).map((f) => `${f.factor} (${f.value})`).join(", ")}.`
    );
  }
  if (topNegativeFactors.length > 0) {
    explanationParts.push(
      `Areas to improve: ${topNegativeFactors.slice(0, 3).map((f) => `${f.factor} — ${f.impact}`).join("; ")}.`
    );
  }
  if (interviewDelta !== 0) {
    explanationParts.push(
      `Interview performance ${interviewDelta > 0 ? "boosted" : "reduced"} your probability by ${Math.abs(interviewDelta)}%.`
    );
  }

  const explanation = explanationParts.join(" ");

  return res.json({
    probability: probabilityPct,
    probabilityBase: baseProbabilityPct,
    probabilityInterviewAdjusted: probabilityPct,
    interviewDelta,
    // AI Explainability
    explanation,
    featureImportance,
    topPositiveFactors: topPositiveFactors.slice(0, 5),
    topNegativeFactors: topNegativeFactors.slice(0, 5),
    model: {
      algorithm: model.algorithm,
      holdoutAccuracyPct: Math.round(prediction.modelAccuracy * 100),
      trainAccuracyPct: Math.round((model.trainAccuracy ?? 0) * 100),
      sampleCount: prediction.sampleCount,
      holdoutAuc: Math.round((model.holdoutAuc ?? 0) * 1000) / 1000,
      confusionMatrix: model.confusionMatrix,
    },
    inputsUsed: {
      cgpa: features.cgpa,
      internships: features.internships,
      projects: features.projects,
      workshopsCertifications: features.workshopsCertifications,
      aptitudeTestScore: Math.round(features.aptitudeTestScore),
      softSkillsRating: Number(features.softSkillsRating.toFixed(1)),
      sscMarks: Math.round(features.sscMarks),
      hscMarks: Math.round(features.hscMarks),
      placementTraining: features.placementTraining,
      interviewOverall: latestInterview ? Number(interviewOverall.toFixed(1)) : null,
      interviewCommunication: latestInterview ? Number(interviewCommunication.toFixed(1)) : null,
      interviewDsa: latestInterview ? Number(interviewDsa.toFixed(1)) : null,
      interviewTechnical: latestInterview ? Number(interviewTechnical.toFixed(1)) : null,
    },
    latestInterview: latestInterview
      ? {
          completedAt: latestInterview.completedAt,
          currentWeek: latestInterview.currentWeek,
          overallScore: Number(interviewOverall.toFixed(1)),
          communicationScore: Number(interviewCommunication.toFixed(1)),
          dsaScore: Number(interviewDsa.toFixed(1)),
          technicalScore: Number(interviewTechnical.toFixed(1)),
        }
      : null,
    checklist,
  });
});
