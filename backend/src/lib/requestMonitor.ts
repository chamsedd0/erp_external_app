import fs from 'fs';
import path from 'path';
import os from 'os';
import { odooClient } from '../odoo/client';
import { notificationStore, Notification } from './notificationStore';

// In serverless environments, use /tmp
const DATA_DIR = path.join(os.tmpdir(), 'shadow_portal_data');
const CACHE_FILE = path.join(DATA_DIR, 'request_cache.json');

// Ensure dir exists (duplicated check for safety)
try {
    if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
    }
} catch (e) {
    console.error("Monitor failed to create data dir:", e);
}

interface RequestState {
    id: number;
    type: 'time_off' | 'expense';
    state: string;
    updated_at: string;
}

interface CacheData {
    [employeeId: number]: {
        [uniqueId: string]: RequestState
    }
}

export const requestMonitor = {
    checkUpdates: async (employeeId: number) => {
        console.log(`Checking updates for employee ${employeeId}...`);

        // 1. Authenticate to get UID
        let uid = 0;
        try {
            uid = await odooClient.authenticate();
        } catch (e) {
            console.error("Monitor failed to authenticate with Odoo:", e);
            return;
        }

        // 2. Fetch current data from Odoo
        let timeOffRequests: any[] = [];
        let expenses: any[] = [];

        try {
            // Explicitly cast the result to any[] because generic Promise return might be unknown
            const leavesResult = await odooClient.searchRead(uid, 'hr.leave',
                [['employee_id', '=', employeeId]],
                ['id', 'name', 'state', 'date_from', 'date_to', 'holiday_status_id']
            );
            timeOffRequests = Array.isArray(leavesResult) ? leavesResult : [];

            const expensesResult = await odooClient.searchRead(uid, 'hr.expense',
                [['employee_id', '=', employeeId]],
                ['id', 'name', 'state', 'total_amount', 'date', 'product_id']
            );
            expenses = Array.isArray(expensesResult) ? expensesResult : [];

        } catch (error) {
            console.error("Monitor failed to fetch from Odoo:", error);
            return;
        }

        // 3. Load Cache
        let cache: CacheData = {};
        if (fs.existsSync(CACHE_FILE)) {
            try {
                cache = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf-8'));
            } catch (e) { cache = {}; }
        }
        if (!cache[employeeId]) cache[employeeId] = {};

        const employeeCache = cache[employeeId];
        const newCache: typeof employeeCache = {};
        const notificationsToAdd: Notification[] = [];

        // 4. Compare Time Off
        for (const req of timeOffRequests) {
            const uniqueId = `time_off_${req.id}`;
            const currentState = req.state;
            const previous = employeeCache[uniqueId];

            // Update new cache
            newCache[uniqueId] = { id: req.id, type: 'time_off', state: currentState, updated_at: new Date().toISOString() };

            if (previous && previous.state !== currentState) {
                // Status Changed!
                const notif = createNotification(employeeId, req, 'time_off', previous.state, currentState);
                if (notif) notificationsToAdd.push(notif);
            }
        }

        // 5. Compare Expenses
        for (const req of expenses) {
            const uniqueId = `expense_${req.id}`;
            const currentState = req.state;
            const previous = employeeCache[uniqueId];

            newCache[uniqueId] = { id: req.id, type: 'expense', state: currentState, updated_at: new Date().toISOString() };

            if (previous && previous.state !== currentState) {
                const notif = createNotification(employeeId, req, 'expense', previous.state, currentState);
                if (notif) notificationsToAdd.push(notif);
            }
        }

        // 6. Save Notifications
        for (const n of notificationsToAdd) {
            notificationStore.add(n);
        }

        // 7. Save Cache
        cache[employeeId] = newCache;
        try {
            fs.writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2));
        } catch (e) {
            console.error("Monitor failed to write cache:", e);
        }
    }
};

function createNotification(
    employeeId: number,
    req: any,
    type: 'time_off' | 'expense',
    oldState: string,
    newState: string
): Notification | null {

    // Map states to user friendly messages
    let title = '';
    let message = '';
    let notifType: 'request_approved' | 'request_rejected' | 'system' = 'system';

    const cleanName = req.name || (type === 'time_off' ? 'Time Off Request' : 'Expense');

    // Approval
    if (['approved', 'validate', 'done', 'posted'].includes(newState) && !['approved', 'validate', 'done', 'posted'].includes(oldState)) {
        title = type === 'time_off' ? 'Request Approved' : 'Expense Approved';
        message = `Your ${type === 'time_off' ? 'time off' : 'expense'} "${cleanName}" has been approved.`;
        notifType = 'request_approved';
    }
    // Rejection
    else if (['refuse', 'refused'].includes(newState)) {
        title = type === 'time_off' ? 'Request Rejected' : 'Expense Rejected';
        message = `Your ${type === 'time_off' ? 'time off' : 'expense'} "${cleanName}" was rejected.`;
        notifType = 'request_rejected';
    }
    // Submission (Draft -> Confirmed/Reported)
    else if (['confirm', 'reported'].includes(newState) && oldState === 'draft') {
        title = 'Submission Received';
        message = `Your ${type === 'time_off' ? 'request' : 'expense'} "${cleanName}" has been submitted for approval.`;
        notifType = 'system';
    }

    if (!title) return null; // Ignore other state transitions for now

    return {
        id: Math.random().toString(36).substring(7), // Simple ID
        employeeId,
        title,
        message,
        type: notifType,
        read: false,
        timestamp: new Date().toISOString(),
        targetId: req.id.toString(),
        targetType: type
    };
}
