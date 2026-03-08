import { Router } from "express";
import multer from "multer";
import { requireAuth } from "../middleware/auth";
import { analyzeResume } from "../services/resumeAnalyzer";
import { ResumeAnalysis } from "../models/ResumeAnalysis";

const router = Router();

// Multer config: in-memory storage, max 10 MB per file
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
        const allowed = ["application/pdf", "text/plain"];
        if (allowed.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error("Only PDF and TXT files are allowed"));
        }
    },
});

// ── Health Check ────────────────────────────────────────────────
router.get("/health", (_req, res) => {
    res.json({ ok: true, service: "resume-analyzer" });
});

// ── POST /analyze  —  Upload resume + JD PDFs, run full pipeline ─
router.post(
    "/analyze",
    requireAuth,
    upload.fields([
        { name: "resume", maxCount: 1 },
        { name: "jd", maxCount: 1 },
    ]),
    async (req, res) => {
        try {
            const files = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;

            if (!files?.resume?.[0]) {
                return res.status(400).json({
                    error: "Resume PDF file is required",
                    fields: { resume: "Resume PDF (required)", jd: "Job Description PDF (optional)" },
                });
            }

            const resumeFile = files.resume[0];
            const jdFile = files.jd?.[0] ?? null;

            console.log(`[ATS] Analyzing: resume=${resumeFile.originalname} (${resumeFile.size}B)${jdFile ? `, jd=${jdFile.originalname} (${jdFile.size}B)` : " (no JD)"}`);

            // Run full analysis pipeline
            const result = await analyzeResume(
                resumeFile.buffer,
                jdFile?.buffer ?? null,
                resumeFile.originalname,
                jdFile?.originalname ?? "(none)",
            );

            // Save to DB
            const userId = req.user!.userId;
            const saved = await ResumeAnalysis.create({
                userId,
                resumeFileName: resumeFile.originalname,
                jdFileName: jdFile?.originalname ?? "(none)",
                resumeText: result.resumeText.slice(0, 50000),
                jdText: (result.jdText || "").slice(0, 50000),
                extractedSkills: result.extractedSkills,
                jdSkills: result.jdSkills,
                matchedSkills: result.matchedSkills,
                missingSkills: result.missingSkills,
                additionalSkills: result.additionalSkills,
                atsScore: result.atsScore,
                categoryPrediction: result.categoryPrediction,
                categoryConfidence: result.categoryConfidence,
                scoreBreakdown: result.scoreBreakdown,
                mlRecommendations: result.mlRecommendations,
                geminiRecommendations: result.geminiRecommendations,
                finalRecommendations: result.finalRecommendations,
            });

            return res.json({
                _id: saved._id,
                resumeFileName: resumeFile.originalname,
                jdFileName: jdFile?.originalname ?? null,
                atsScore: result.atsScore,
                categoryPrediction: result.categoryPrediction,
                categoryConfidence: result.categoryConfidence,
                scoreBreakdown: result.scoreBreakdown,
                extractedSkills: result.extractedSkills,
                jdSkills: result.jdSkills,
                matchedSkills: result.matchedSkills,
                missingSkills: result.missingSkills,
                additionalSkills: result.additionalSkills,
                mlRecommendations: result.mlRecommendations,
                geminiRecommendations: result.geminiRecommendations,
                finalRecommendations: result.finalRecommendations,
                pipeline: result.pipeline,
            });
        } catch (e: any) {
            console.error("[ATS] Analysis error:", e);
            return res.status(500).json({
                error: "Resume analysis failed",
                details: String(e?.message ?? e),
            });
        }
    }
);

// ── GET /history  —  Past analyses for the authenticated user ───
router.get("/history", requireAuth, async (req, res) => {
    try {
        const userId = req.user!.userId;
        const analyses = await ResumeAnalysis.find({ userId })
            .sort({ createdAt: -1 })
            .limit(20)
            .select("-resumeText -jdText")  // Skip large text fields
            .lean();

        return res.json({ analyses });
    } catch (e: any) {
        return res.status(500).json({
            error: "Failed to fetch history",
            details: String(e?.message ?? e),
        });
    }
});

export default router;
