import request from 'supertest';
import app from '../../index';
import { pushStore } from '../../lib/pushStore';
import { requestMonitor } from '../../lib/requestMonitor';

jest.mock('../../lib/pushStore');
jest.mock('../../lib/requestMonitor');

const mockPushStore = pushStore as jest.Mocked<typeof pushStore>;
const mockMonitor = requestMonitor as jest.Mocked<typeof requestMonitor>;

beforeEach(() => {
    jest.clearAllMocks();
    mockMonitor.checkUpdates.mockResolvedValue(undefined);
});

// ─── GET /cron/check-updates ───────────────────────────────────────────────────

describe('GET /cron/check-updates', () => {
    it('returns 200 with checked=0 when no push tokens are registered', async () => {
        mockPushStore.listAllTokens.mockResolvedValue([]);

        const res = await request(app).get('/cron/check-updates');

        expect(res.status).toBe(200);
        expect(res.body.checked).toBe(0);
        expect(mockMonitor.checkUpdates).not.toHaveBeenCalled();
    });

    it('calls checkUpdates for each registered token', async () => {
        mockPushStore.listAllTokens.mockResolvedValue([
            { tenantId: 'acme', employeeId: 1 },
            { tenantId: 'acme', employeeId: 2 },
            { tenantId: 'globex', employeeId: 5 },
        ]);

        const res = await request(app).get('/cron/check-updates');

        expect(res.status).toBe(200);
        expect(res.body.checked).toBe(3);
        expect(res.body.succeeded).toBe(3);
        expect(res.body.failed).toBe(0);
        expect(mockMonitor.checkUpdates).toHaveBeenCalledTimes(3);
        expect(mockMonitor.checkUpdates).toHaveBeenCalledWith(1, 'acme');
        expect(mockMonitor.checkUpdates).toHaveBeenCalledWith(2, 'acme');
        expect(mockMonitor.checkUpdates).toHaveBeenCalledWith(5, 'globex');
    });

    it('counts failures but does not crash when some checkUpdates calls throw', async () => {
        mockPushStore.listAllTokens.mockResolvedValue([
            { tenantId: 'acme', employeeId: 1 },
            { tenantId: 'broken', employeeId: 2 },
            { tenantId: 'acme', employeeId: 3 },
        ]);
        mockMonitor.checkUpdates
            .mockResolvedValueOnce(undefined)                    // #1 succeeds
            .mockRejectedValueOnce(new Error('Odoo down'))       // #2 fails
            .mockResolvedValueOnce(undefined);                   // #3 succeeds

        const res = await request(app).get('/cron/check-updates');

        expect(res.status).toBe(200);
        expect(res.body.checked).toBe(3);
        expect(res.body.succeeded).toBe(2);
        expect(res.body.failed).toBe(1);
    });

    it('responds with durationMs field', async () => {
        mockPushStore.listAllTokens.mockResolvedValue([{ tenantId: 'x', employeeId: 99 }]);

        const res = await request(app).get('/cron/check-updates');

        expect(res.status).toBe(200);
        expect(typeof res.body.durationMs).toBe('number');
        expect(res.body.durationMs).toBeGreaterThanOrEqual(0);
    });

    it('rejects with 401 when CRON_SECRET is set and header is wrong', async () => {
        const original = process.env.CRON_SECRET;
        process.env.CRON_SECRET = 'super-secret-cron-key';
        mockPushStore.listAllTokens.mockResolvedValue([]);

        const res = await request(app)
            .get('/cron/check-updates')
            .set('Authorization', 'Bearer wrong-key');

        expect(res.status).toBe(401);
        // Use delete — assigning undefined coerces to the string "undefined" (truthy)
        if (original !== undefined) { process.env.CRON_SECRET = original; } else { delete process.env.CRON_SECRET; }
    });

    it('accepts request when CRON_SECRET matches', async () => {
        const original = process.env.CRON_SECRET;
        process.env.CRON_SECRET = 'super-secret-cron-key';
        mockPushStore.listAllTokens.mockResolvedValue([]);

        const res = await request(app)
            .get('/cron/check-updates')
            .set('Authorization', 'Bearer super-secret-cron-key');

        expect(res.status).toBe(200);
        if (original !== undefined) { process.env.CRON_SECRET = original; } else { delete process.env.CRON_SECRET; }
    });

    it('accepts request with no CRON_SECRET set (dev mode)', async () => {
        const original = process.env.CRON_SECRET;
        delete process.env.CRON_SECRET;
        mockPushStore.listAllTokens.mockResolvedValue([]);

        const res = await request(app).get('/cron/check-updates');

        expect(res.status).toBe(200);
        if (original !== undefined) { process.env.CRON_SECRET = original; } else { delete process.env.CRON_SECRET; }
    });

    it('handles listAllTokens throwing without crashing', async () => {
        mockPushStore.listAllTokens.mockRejectedValue(new Error('Redis unavailable'));

        // checkUpdates should never be called; the caught error propagates to 500
        const res = await request(app).get('/cron/check-updates');
        // May be 500 or the express error handler — just verify it doesn't hang/crash
        expect([200, 500]).toContain(res.status);
    });
});
