import fs from 'fs';
import path from 'path';
import { odooClient } from '../odoo/client';
import { notificationStore, Notification } from './notificationStore';

// Simple ID generator to avoid adding uuid dependency if not present
const generateId = () => Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);

const DATA_DIR = path.join(__dirname, '../../data');
const CACHE_FILE_PATH = path.join(DATA_DIR, 'request_cache.json');

// Ensure file exists
if (!fs.existsSync(CACHE_FILE_PATH)) {
    fs.writeFileSync(CACHE_FILE_PATH, JSON.stringify({}));
}

export const requestMonitor = {
    checkUpdates: async (userId: number) => {
        try {
            // 1. Load Cache
            const cacheRaw = fs.readFileSync(CACHE_FILE_PATH, 'utf-8');
            let cache = JSON.parse(cacheRaw);

            // 2. Fetch Current Data from Odoo
            const uid = await odooClient.authenticate();

            // Fetch Leaves
            const leaves = await odooClient.searchRead(
                uid,
                'hr.leave',
                [['employee_id', '=', userId]],
                ['id', 'name', 'state', 'holiday_status_id'] // holiday_status_id for name if needed
            ) as any[];

            // Fetch Expenses
            const expenses = await odooClient.searchRead(
                uid,
                'hr.expense',
                [['employee_id', '=', userId]],
                ['id', 'name', 'state', 'total_amount']
            ) as any[];

            // 3. Compare and Notify
            const updates: any[] = []; // Track updates to verify log

            // Check Leaves
            for (const leave of leaves) {
                const cacheKey = `leave_${leave.id}`;
                const lastState = cache[cacheKey];
                const currentState = leave.state;

                if (lastState && lastState !== currentState) {
                    // Status Changed
                    let message = `Your time off request "${leave.name || 'Request'}" status changed to ${currentState}`;
                    let type: Notification['type'] = 'system';

                    if (currentState === 'validate') {
                        message = `Your time off request "${leave.name || 'Request'}" has been approved!`;
                        type = 'request_approved';
                    } else if (currentState === 'refuse') {
                        message = `Your time off request "${leave.name || 'Request'}" was rejected.`;
                        type = 'request_rejected';
                    }

                    notificationStore.add({
                        id: generateId(),
                        userId,
                        title: 'Time Off Update',
                        message,
                        type,
                        read: false,
                        timestamp: new Date().toISOString(),
                        relatedRequestId: leave.id,
                        relatedRequestType: 'time_off'
                    });
                }

                cache[cacheKey] = currentState;
            }

            // Check Expenses
            for (const expense of expenses) {
                const cacheKey = `expense_${expense.id}`;
                const lastState = cache[cacheKey];
                const currentState = expense.state;

                if (lastState && lastState !== currentState) {
                    // Status Changed
                    let message = `Your expense claim "${expense.name || 'Expense'}" status changed to ${currentState}`;
                    let type: Notification['type'] = 'system';

                    if (['approved', 'done', 'posted'].includes(currentState)) {
                        message = `Your expense claim "${expense.name || 'Expense'}" has been approved.`;
                        type = 'request_approved';
                    } else if (['refused', 'cancel'].includes(currentState)) {
                        message = `Your expense claim "${expense.name || 'Expense'}" was rejected.`;
                        type = 'request_rejected';
                    }

                    notificationStore.add({
                        id: generateId(),
                        userId,
                        title: 'Expense Update',
                        message,
                        type,
                        read: false,
                        timestamp: new Date().toISOString(),
                        relatedRequestId: expense.id,
                        relatedRequestType: 'expense'
                    });
                }

                cache[cacheKey] = currentState;
            }

            // 4. Save Cache
            fs.writeFileSync(CACHE_FILE_PATH, JSON.stringify(cache, null, 2));

        } catch (error) {
            console.error('Request Monitor Error:', error);
        }
    }
};
