"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.cronRouter = void 0;
const express_1 = require("express");
const pushStore_1 = require("../lib/pushStore");
const requestMonitor_1 = require("../lib/requestMonitor");
const cronRouter = (0, express_1.Router)();
exports.cronRouter = cronRouter;
/**
 * GET /cron/check-updates
 *
 * Called by Vercel Cron every 15 minutes.
 * Loops through every employee who has a registered push token and
 * runs checkUpdates for them — detecting Odoo status changes and
 * firing push notifications even when the app is closed.
 *
 * Protected by the CRON_SECRET Vercel injects as:
 *   Authorization: Bearer <CRON_SECRET>
 */
cronRouter.get('/check-updates', async (req, res) => {
    const authHeader = req.headers.authorization ?? '';
    const cronSecret = process.env.CRON_SECRET;
    // In production, Vercel sends Authorization: Bearer <CRON_SECRET>
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    const started = Date.now();
    const tokens = await pushStore_1.pushStore.listAllTokens();
    if (tokens.length === 0) {
        return res.json({ checked: 0, durationMs: Date.now() - started });
    }
    console.log(`[cron] Starting check for ${tokens.length} employee(s)...`);
    // Run all checks concurrently — each is independent and fails silently
    const results = await Promise.allSettled(tokens.map(({ tenantId, employeeId }) => requestMonitor_1.requestMonitor.checkUpdates(employeeId, tenantId)));
    const failed = results.filter(r => r.status === 'rejected').length;
    const durationMs = Date.now() - started;
    console.log(`[cron] Done — ${tokens.length - failed}/${tokens.length} succeeded in ${durationMs}ms`);
    res.json({
        checked: tokens.length,
        succeeded: tokens.length - failed,
        failed,
        durationMs,
    });
});
