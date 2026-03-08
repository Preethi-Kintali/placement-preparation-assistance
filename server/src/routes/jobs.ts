import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import { fetchRoleSuggestions, fetchJobs } from "../services/jobSearch";
import { env } from "../config/env";

export const jobsRouter = Router();

/**
 * GET /api/jobs/roles?q=...
 * Returns role suggestions for autocomplete.
 */
jobsRouter.get("/roles", requireAuth, async (req, res) => {
    if (!env.RAPIDAPI_KEY) {
        return res.status(500).json({ error: "RAPIDAPI_KEY is not configured" });
    }

    const q = String(req.query.q || "").trim().replace(/\s+/g, " ");
    if (!q) {
        return res.status(400).json({ error: "Query parameter 'q' is required" });
    }

    try {
        const roles = await fetchRoleSuggestions(q);
        return res.json({ query: q, roles });
    } catch (error: any) {
        return res.status(500).json({
            error: "Failed to fetch roles",
            details: error.message,
        });
    }
});

/**
 * GET /api/jobs/search?role=...
 * Returns live job listings for the given role.
 */
jobsRouter.get("/search", requireAuth, async (req, res) => {
    if (!env.RAPIDAPI_KEY) {
        return res.status(500).json({ error: "RAPIDAPI_KEY is not configured" });
    }

    const role = String(req.query.role || "full stack developer")
        .trim()
        .replace(/\s+/g, " ");
    if (!role) {
        return res.status(400).json({ error: "'role' is required" });
    }

    try {
        const jobs = await fetchJobs(role);
        return res.json({ role, count: jobs.length, jobs, source: "rapidapi" });
    } catch (error: any) {
        return res.status(502).json({
            error: "Live jobs provider failed",
            role,
            details: error.message,
        });
    }
});
