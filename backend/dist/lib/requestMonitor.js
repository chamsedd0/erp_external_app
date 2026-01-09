"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.requestMonitor = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const client_1 = require("../odoo/client");
const notificationStore_1 = require("./notificationStore");
// Cache last known state of requests to detect changes
const DATA_DIR = path_1.default.join(__dirname, '../../data');
const CACHE_FILE = path_1.default.join(DATA_DIR, 'request_cache.json');
exports.requestMonitor = {
    checkUpdates: async (employeeId) => {
        console.log(`Checking updates for employee ${employeeId}...`);
        // 1. Fetch current data from Odoo
        let timeOffRequests = [];
        let expenses = [];
        try {
            // Using searchRead manually since we are in lib, or use existing services if possible.
            // But we can directly use odooClient for flexibility.
            timeOffRequests = await client_1.odooClient.searchRead('hr.leave', [['employee_id', '=', employeeId]], ['id', 'name', 'state', 'date_from', 'date_to', 'holiday_status_id']);
            expenses = await client_1.odooClient.searchRead('hr.expense', [['employee_id', '=', employeeId]], ['id', 'name', 'state', 'total_amount', 'date', 'product_id']);
        }
        catch (error) {
            console.error("Monitor failed to fetch from Odoo:", error);
            return;
        }
        // 2. Load Cache
        let cache = {};
        if (fs_1.default.existsSync(CACHE_FILE)) {
            try {
                cache = JSON.parse(fs_1.default.readFileSync(CACHE_FILE, 'utf-8'));
            }
            catch (e) {
                cache = {};
            }
        }
        if (!cache[employeeId])
            cache[employeeId] = {};
        const employeeCache = cache[employeeId];
        const newCache = {};
        const notificationsToAdd = [];
        // 3. Compare Time Off
        for (const req of timeOffRequests) {
            const uniqueId = `time_off_${req.id}`;
            const currentState = req.state;
            const previous = employeeCache[uniqueId];
            // Update new cache
            newCache[uniqueId] = { id: req.id, type: 'time_off', state: currentState, updated_at: new Date().toISOString() };
            if (previous && previous.state !== currentState) {
                // Status Changed!
                const notif = createNotification(employeeId, req, 'time_off', previous.state, currentState);
                if (notif)
                    notificationsToAdd.push(notif);
            }
            else if (!previous && currentState !== 'draft' && currentState !== 'confirm') {
                // New request found that isn't just a draft (maybe created externally or first time sync)
                // Optional: Notify about "Request Received" if created elsewhere? 
                // For now, let's only notify on CHANGES to existing monitored items or significant status.
            }
        }
        // 4. Compare Expenses
        for (const req of expenses) {
            const uniqueId = `expense_${req.id}`;
            const currentState = req.state;
            const previous = employeeCache[uniqueId];
            newCache[uniqueId] = { id: req.id, type: 'expense', state: currentState, updated_at: new Date().toISOString() };
            if (previous && previous.state !== currentState) {
                const notif = createNotification(employeeId, req, 'expense', previous.state, currentState);
                if (notif)
                    notificationsToAdd.push(notif);
            }
        }
        // 5. Save Notifications
        for (const n of notificationsToAdd) {
            notificationStore_1.notificationStore.add(n);
        }
        // 6. Save Cache
        cache[employeeId] = newCache;
        fs_1.default.writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2));
    }
};
function createNotification(employeeId, req, type, oldState, newState) {
    // Map states to user friendly messages
    // Expenses: draft -> reported -> approved -> done (refused)
    // Time Off: draft -> confirm -> validate1 -> validate (refuse)
    let title = '';
    let message = '';
    let notifType = 'system';
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
    if (!title)
        return null; // Ignore other state transitions for now
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
