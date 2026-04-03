/**
 * ═══════════════════════════════════════════════════════════════════
 *  KNOWLEDGE BASE API — PDF Upload, Management, Evaluation
 * ═══════════════════════════════════════════════════════════════════
 */

import { Router } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { requireAuth } from "../middleware/auth";
import { ingestPdf, getRagStatus, clearRagCache } from "../services/ragPipeline";
import { RagChunk } from "../models/RagChunk";
import { StudySession } from "../models/StudySession";

const router = Router();

// Upload directory
const UPLOAD_DIR = path.resolve(process.cwd(), "..", "uploads");
if (!fs.existsSync(UPLOAD_DIR)) {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

const upload = multer({
    dest: UPLOAD_DIR,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB max
    fileFilter: (_req, file, cb) => {
        if (file.mimetype === "application/pdf") {
            cb(null, true);
        } else {
            cb(new Error("Only PDF files are allowed"));
        }
    },
});

// POST /api/knowledge/upload — Upload and ingest a PDF
router.post("/upload", requireAuth, upload.single("file"), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: "No PDF file uploaded" });
        }

        const originalName = req.file.originalname || "document.pdf";
        const finalPath = path.join(UPLOAD_DIR, originalName);

        // Rename from multer temp to original name
        fs.renameSync(req.file.path, finalPath);

        const tags = req.body.tags
            ? String(req.body.tags).split(",").map((t: string) => t.trim()).filter(Boolean)
            : [];

        // Ingest the PDF (async — this takes time)
        const result = await ingestPdf(finalPath, tags);

        return res.json({
            success: true,
            document: {
                source: result.source,
                totalChunks: result.totalChunks,
                textLength: result.textLength,
                tags,
            },
        });
    } catch (e: any) {
        // Clean up temp file on error
        if (req.file?.path && fs.existsSync(req.file.path)) {
            fs.unlinkSync(req.file.path);
        }
        return res.status(500).json({ error: "Upload failed", details: e?.message });
    }
});

// GET /api/knowledge/documents — List all indexed documents
router.get("/documents", requireAuth, async (_req, res) => {
    try {
        const sources = await RagChunk.aggregate([
            {
                $group: {
                    _id: "$source",
                    chunkCount: { $sum: 1 },
                    firstIndexed: { $min: "$createdAt" },
                    lastUpdated: { $max: "$updatedAt" },
                },
            },
            { $sort: { lastUpdated: -1 } },
        ]);

        const documents = sources.map((s) => ({
            source: s._id,
            chunkCount: s.chunkCount,
            firstIndexed: s.firstIndexed,
            lastUpdated: s.lastUpdated,
        }));

        return res.json({ documents });
    } catch (e: any) {
        return res.status(500).json({ error: "Failed to list documents", details: e?.message });
    }
});

// DELETE /api/knowledge/:source — Remove a document and its chunks
router.delete("/:source", requireAuth, async (req, res) => {
    try {
        const source = decodeURIComponent(req.params.source);
        const deleted = await RagChunk.deleteMany({ source });

        // Delete file if exists
        const filePath = path.join(UPLOAD_DIR, source);
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }

        // Clear cache
        clearRagCache();

        return res.json({
            success: true,
            deletedChunks: deleted.deletedCount,
            source,
        });
    } catch (e: any) {
        return res.status(500).json({ error: "Delete failed", details: e?.message });
    }
});

// GET /api/knowledge/status — RAG system status
router.get("/status", async (_req, res) => {
    try {
        const status = await getRagStatus();
        return res.json(status);
    } catch (e: any) {
        return res.status(500).json({ error: "Status check failed", details: e?.message });
    }
});

// GET /api/knowledge/evaluation — RAG evaluation metrics
router.get("/evaluation", requireAuth, async (_req, res) => {
    try {
        const totalSessions = await StudySession.countDocuments();
        const ragStatus = await getRagStatus();

        // Get recent sessions to analyze
        const recentSessions = await StudySession.find()
            .sort({ createdAt: -1 })
            .limit(50)
            .lean();

        // Calculate metrics
        const withCitations = recentSessions.filter(
            (s: any) => s.citations && s.citations.length > 0
        ).length;

        const avgCitations = recentSessions.length > 0
            ? recentSessions.reduce(
                (sum: number, s: any) => sum + ((s.citations?.length as number) || 0), 0
            ) / recentSessions.length
            : 0;

        const providerBreakdown: Record<string, number> = {};
        for (const s of recentSessions) {
            const p = (s as any).provider || "unknown";
            providerBreakdown[p] = (providerBreakdown[p] || 0) + 1;
        }

        return res.json({
            totalSessions,
            ragIndexed: ragStatus.indexed,
            totalChunks: ragStatus.totalChunks,
            sources: ragStatus.sources,
            cacheSize: ragStatus.cacheSize,
            recentMetrics: {
                sessionsAnalyzed: recentSessions.length,
                withCitations,
                citationRate: recentSessions.length > 0
                    ? Math.round((withCitations / recentSessions.length) * 100)
                    : 0,
                avgCitationsPerResponse: Math.round(avgCitations * 10) / 10,
                providerBreakdown,
            },
        });
    } catch (e: any) {
        return res.status(500).json({ error: "Evaluation failed", details: e?.message });
    }
});

export { router as knowledgeRouter };
