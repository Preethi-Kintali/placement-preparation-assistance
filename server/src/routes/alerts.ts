/**
 * ═══════════════════════════════════════════════════════════════════
 *  ALERTS API — Smart Notification System
 * ═══════════════════════════════════════════════════════════════════
 */

import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import {
    runAlertChecks,
    getUserAlerts,
    getUnreadCount,
    markAlertRead,
    markAllRead,
} from "../services/alertEngine";

const router = Router();

// GET /api/alerts — fetch user alerts
router.get("/", requireAuth, async (req, res) => {
    try {
        const userId = req.user!.userId;
        const unreadOnly = req.query.unread === "true";
        const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 20));

        const alerts = await getUserAlerts(userId, { unreadOnly, limit });
        return res.json({ alerts });
    } catch (e: any) {
        return res.status(500).json({ error: "Failed to fetch alerts", details: e?.message });
    }
});

// GET /api/alerts/count — unread count (for navbar badge)
router.get("/count", requireAuth, async (req, res) => {
    try {
        const count = await getUnreadCount(req.user!.userId);
        return res.json({ count });
    } catch (e: any) {
        return res.status(500).json({ error: "Failed to count alerts", details: e?.message });
    }
});

// POST /api/alerts/check — trigger alert checks
router.post("/check", requireAuth, async (req, res) => {
    try {
        const newAlerts = await runAlertChecks(req.user!.userId);
        const count = await getUnreadCount(req.user!.userId);
        return res.json({ newAlerts, unreadCount: count });
    } catch (e: any) {
        return res.status(500).json({ error: "Alert check failed", details: e?.message });
    }
});

// PATCH /api/alerts/:id/read — mark single alert as read
router.patch("/:id/read", requireAuth, async (req, res) => {
    try {
        const success = await markAlertRead(req.params.id, req.user!.userId);
        return res.json({ success });
    } catch (e: any) {
        return res.status(500).json({ error: "Failed to mark alert", details: e?.message });
    }
});

// PATCH /api/alerts/read-all — mark all as read
router.patch("/read-all", requireAuth, async (req, res) => {
    try {
        const count = await markAllRead(req.user!.userId);
        return res.json({ marked: count });
    } catch (e: any) {
        return res.status(500).json({ error: "Failed to mark all", details: e?.message });
    }
});

export { router as alertsRouter };
