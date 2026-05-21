import { Router } from 'express';
import { pushStore } from '../lib/pushStore';
import { requestMonitor } from '../lib/requestMonitor';

const cronRouter = Router();

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
    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    const started = Date.now();
    const tokens = await pushStore.listAllTokens();

    if (tokens.length === 0) {
        return res.json({ checked: 0, durationMs: Date.now() - started });
    }

    console.log(`[cron] Starting check for ${tokens.length} employee(s)...`);

    // Run all checks concurrently — each is independent and fails silently
    const results: PromiseSettledResult<void>[] = [];
    const concurrency = 5;
    for (let i = 0; i < tokens.length; i += concurrency) {
        const batch = tokens.slice(i, i + concurrency);
        results.push(...await Promise.allSettled(
            batch.map(({ tenantId, employeeId }) =>
                requestMonitor.checkUpdates(employeeId, tenantId)
            )
        ));
    }

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

export { cronRouter };
