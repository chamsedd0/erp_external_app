import { randomUUID } from 'crypto';
import { getOdooClient } from '../odoo/client';
import { tenantStore } from './tenantStore';
import { notificationStore, Notification } from './notificationStore';
import { sendPushNotification } from './pushStore';
import { redisGet, redisSet } from './redis';

// ── Types ─────────────────────────────────────────────────────────────────────

type RequestType = 'timeoff' | 'expense' | 'helpdesk' | 'maintenance';

interface RequestState {
    id: number;
    type: RequestType;
    /** For leave/expense: string state (e.g. 'draft', 'validate'). For helpdesk/maintenance: stage id as string. */
    state: string;
    updated_at: string;
}

interface EmployeeCache {
    [uniqueId: string]: RequestState;
}

const cacheKey = (tenantId: string, employeeId: number) => `shadow:t:${tenantId}:req_cache:${employeeId}`;
const monitorStatusKey = (tenantId: string) => `shadow:t:${tenantId}:monitor_status`;

async function loadCache(tenantId: string, employeeId: number): Promise<EmployeeCache> {
    try {
        const raw = await redisGet(cacheKey(tenantId, employeeId));
        if (!raw) return {};
        return JSON.parse(raw) as EmployeeCache;
    } catch {
        return {};
    }
}

async function saveCache(tenantId: string, employeeId: number, cache: EmployeeCache): Promise<void> {
    try {
        await redisSet(cacheKey(tenantId, employeeId), JSON.stringify(cache));
    } catch (e) {
        console.error('Monitor failed to write cache to Redis:', e);
    }
}

// ── Monitor ───────────────────────────────────────────────────────────────────

export const requestMonitor = {
    checkUpdates: async (employeeId: number, tenantId: string) => {
        console.log(`[${tenantId}] Checking updates for employee ${employeeId}...`);

        // Load tenant config
        const cfg = await tenantStore.getTenant(tenantId);
        if (!cfg) {
            console.error(`[${tenantId}] Monitor: unknown tenant`);
            return;
        }

        const client = getOdooClient(tenantId, cfg);

        // 1. Authenticate
        let uid = 0;
        try {
            uid = await client.authenticate();
        } catch (e) {
            console.error(`[${tenantId}] Monitor failed to authenticate with Odoo:`, e);
            return;
        }

        // 2. Fetch current data from Odoo — each type is independent.
        // IMPORTANT: use separate try/catch per type so a failure in one does NOT
        // prevent the others from fetching, and does NOT corrupt their cache entries.
        let timeOffRequests: any[] = [];
        let expenses: any[] = [];
        let helpdeskTickets: any[] = [];
        let maintenanceRequests: any[] = [];

        // Track which types were successfully fetched so we know which cache entries to update.
        const fetched = { timeOff: false, expense: false, helpdesk: false, maintenance: false };

        try {
            const result = await client.searchRead(uid, 'hr.leave',
                [['employee_id', '=', employeeId]],
                ['id', 'name', 'state', 'date_from', 'date_to'],
                true  // silent
            );
            timeOffRequests = Array.isArray(result) ? result : [];
            fetched.timeOff = true;
        } catch {
            console.warn(`[${tenantId}] [monitor] Could not fetch hr.leave for employee ${employeeId} — keeping cached state.`);
        }

        try {
            const result = await client.searchRead(uid, 'hr.expense',
                [['employee_id', '=', employeeId]],
                ['id', 'name', 'state', 'total_amount', 'date', 'product_id'],
                true  // silent
            );
            expenses = Array.isArray(result) ? result : [];
            fetched.expense = true;
        } catch {
            console.warn(`[${tenantId}] [monitor] Could not fetch hr.expense for employee ${employeeId} — keeping cached state.`);
        }

        // Helpdesk — Enterprise only, silent=true
        // We must filter by the employee's partner_id to avoid leaking all company tickets.
        // If we can't resolve the partner_id, skip helpdesk monitoring for this employee.
        try {
            const empResult: any = await client.searchRead(uid, 'hr.employee',
                [['id', '=', employeeId]],
                ['id', 'user_id'],
                true
            );
            const emp = Array.isArray(empResult) ? empResult[0] : null;
            if (emp && Array.isArray(emp.user_id) && emp.user_id[0]) {
                const userResult: any = await client.searchRead(uid, 'res.users',
                    [['id', '=', emp.user_id[0]]],
                    ['id', 'partner_id'],
                    true
                );
                const partnerId = Array.isArray(userResult) && userResult[0]?.partner_id
                    ? userResult[0].partner_id[0]
                    : null;

                if (partnerId) {
                    const result = await client.searchRead(uid, 'helpdesk.ticket',
                        [['partner_id', '=', partnerId]],
                        ['id', 'name', 'stage_id', 'create_date', 'partner_id'],
                        true
                    );
                    helpdeskTickets = Array.isArray(result) ? result : [];
                    fetched.helpdesk = true;
                }
                // If no partner_id resolved, skip helpdesk — leave fetched.helpdesk = false
            }
        } catch {
            // Module not installed or employee has no linked user — skip silently
        }

        // Maintenance — may not be installed on all instances, silent=true
        try {
            const result = await client.searchRead(uid, 'maintenance.request',
                [['employee_id', '=', employeeId]],
                ['id', 'name', 'stage_id', 'create_date', 'maintenance_type'],
                true
            );
            maintenanceRequests = Array.isArray(result) ? result : [];
            fetched.maintenance = true;
        } catch {
            // Module not available — skip silently
        }

        // 3. Load Cache from Redis
        const employeeCache = await loadCache(tenantId, employeeId);

        // Start newCache from the EXISTING cache so that entries for types that
        // failed to fetch this cycle are preserved, not wiped out.
        const newCache: EmployeeCache = { ...employeeCache };
        const notificationsToAdd: Notification[] = [];

        // ── 4. Compare Time Off (string state) ────────────────────────────────
        if (fetched.timeOff) for (const req of timeOffRequests) {
            const uniqueId = `time_off_${req.id}`;
            const currentState = req.state as string;
            const previous = employeeCache[uniqueId];

            newCache[uniqueId] = { id: req.id, type: 'timeoff', state: currentState, updated_at: new Date().toISOString() };

            if (previous && previous.state !== currentState) {
                const notif = createLeaveExpenseNotification(employeeId, req, 'timeoff', previous.state, currentState);
                if (notif) notificationsToAdd.push(notif);
            }
        }

        // ── 5. Compare Expenses (string state) ────────────────────────────────
        if (fetched.expense) for (const req of expenses) {
            const uniqueId = `expense_${req.id}`;
            const currentState = req.state as string;
            const previous = employeeCache[uniqueId];

            newCache[uniqueId] = { id: req.id, type: 'expense', state: currentState, updated_at: new Date().toISOString() };

            if (previous && previous.state !== currentState) {
                const notif = createLeaveExpenseNotification(employeeId, req, 'expense', previous.state, currentState);
                if (notif) notificationsToAdd.push(notif);
            }
        }

        // ── 6. Compare Helpdesk Tickets (stage_id based) ──────────────────────
        if (fetched.helpdesk) for (const req of helpdeskTickets) {
            const uniqueId = `helpdesk_${req.id}`;
            const stageId = Array.isArray(req.stage_id) ? String(req.stage_id[0]) : String(req.stage_id);
            const stageName = Array.isArray(req.stage_id) ? (req.stage_id[1] as string) : '';
            const previous = employeeCache[uniqueId];

            newCache[uniqueId] = { id: req.id, type: 'helpdesk', state: stageId, updated_at: new Date().toISOString() };

            if (previous && previous.state !== stageId) {
                const isDoneStage = /\b(done|closed|resolved|cancel)/i.test(stageName);
                const notif: Notification = {
                    id: randomUUID(),
                    employeeId,
                    title: isDoneStage ? 'Helpdesk Ticket Closed' : 'Helpdesk Ticket Updated',
                    message: `Your ticket "${req.name}" moved to stage: ${stageName || 'Updated'}.`,
                    type: isDoneStage ? 'request_approved' : 'system',
                    read: false,
                    timestamp: new Date().toISOString(),
                    targetId: req.id.toString(),
                    targetType: 'helpdesk',
                };
                notificationsToAdd.push(notif);
            }
        }

        // ── 7. Compare Maintenance Requests (stage_id based) ──────────────────
        if (fetched.maintenance) for (const req of maintenanceRequests) {
            const uniqueId = `maintenance_${req.id}`;
            const stageId = Array.isArray(req.stage_id) ? String(req.stage_id[0]) : String(req.stage_id);
            const stageName = Array.isArray(req.stage_id) ? (req.stage_id[1] as string) : '';
            const previous = employeeCache[uniqueId];

            newCache[uniqueId] = { id: req.id, type: 'maintenance', state: stageId, updated_at: new Date().toISOString() };

            if (previous && previous.state !== stageId) {
                const isDoneStage = /\b(done|repaired|closed|cancel)/i.test(stageName);
                const notif: Notification = {
                    id: randomUUID(),
                    employeeId,
                    title: isDoneStage ? 'Maintenance Request Completed' : 'Maintenance Request Updated',
                    message: `Your maintenance request "${req.name}" moved to: ${stageName || 'Updated'}.`,
                    type: isDoneStage ? 'request_approved' : 'system',
                    read: false,
                    timestamp: new Date().toISOString(),
                    targetId: req.id.toString(),
                    targetType: 'maintenance',
                };
                notificationsToAdd.push(notif);
            }
        }

        // ── 8. Save notifications + send push ─────────────────────────────────
        for (const n of notificationsToAdd) {
            await notificationStore.add(tenantId, n);
            sendPushNotification(tenantId, employeeId, {
                title: n.title,
                body: n.message,
                data: { targetId: n.targetId, targetType: n.targetType },
            }).catch(() => {});
        }

        // ── 9. Save updated cache to Redis ────────────────────────────────────
        await saveCache(tenantId, employeeId, newCache);
        await redisSet(monitorStatusKey(tenantId), JSON.stringify({
            last_run_at: new Date().toISOString(),
            employee_id: employeeId,
            notifications_created: notificationsToAdd.length,
            fetched,
        })).catch(() => undefined);
    },
};

// ── Notification factory for leave / expense (string-state models) ────────────

function createLeaveExpenseNotification(
    employeeId: number,
    req: any,
    type: 'timeoff' | 'expense',
    oldState: string,
    newState: string
): Notification | null {
    let title = '';
    let message = '';
    let notifType: Notification['type'] = 'system';

    const label = type === 'timeoff' ? 'time off request' : 'expense';
    const cleanName = req.name || (type === 'timeoff' ? 'Time Off Request' : 'Expense');

    const approvedStates = ['approved', 'validate', 'validate1', 'done', 'posted'];
    const refusedStates = ['refuse', 'refused', 'cancel'];

    if (approvedStates.includes(newState) && !approvedStates.includes(oldState)) {
        title = type === 'timeoff' ? 'Request Approved ✅' : 'Expense Approved ✅';
        message = `Your ${label} "${cleanName}" has been approved.`;
        notifType = 'request_approved';
    } else if (refusedStates.includes(newState)) {
        title = type === 'timeoff' ? 'Request Rejected ❌' : 'Expense Rejected ❌';
        message = `Your ${label} "${cleanName}" was rejected.`;
        notifType = 'request_rejected';
    }
    // Per owner's requirement: do NOT notify on submission (draft → confirm).

    if (!title) return null;

    return {
        id: randomUUID(),
        employeeId,
        title,
        message,
        type: notifType,
        read: false,
        timestamp: new Date().toISOString(),
        targetId: req.id.toString(),
        targetType: type,
    };
}
