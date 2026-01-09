"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.notificationsRouter = void 0;
const express_1 = __importDefault(require("express"));
const notificationStore_1 = require("../lib/notificationStore");
const requestMonitor_1 = require("../lib/requestMonitor");
exports.notificationsRouter = express_1.default.Router();
// Get notifications (triggers a sync check first)
exports.notificationsRouter.get('/', async (req, res) => {
    try {
        const employeeId = req.query.employee_id;
        if (!employeeId) {
            res.status(400).json({ error: 'employee_id is required' });
            return;
        }
        const id = parseInt(employeeId);
        // 1. Trigger the monitor to check for new updates from Odoo
        // We await this so the user gets the latest notifications immediately on pull-to-refresh
        await requestMonitor_1.requestMonitor.checkUpdates(id);
        // 2. Fetch from store
        const notifications = notificationStore_1.notificationStore.getAll(id);
        // Sort by newest first
        notifications.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        res.json({ notifications });
    }
    catch (error) {
        console.error('Error fetching notifications:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});
// Mark as read
exports.notificationsRouter.put('/:id/read', (req, res) => {
    try {
        const { id } = req.params;
        notificationStore_1.notificationStore.markRead(id);
        res.json({ success: true });
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to mark as read' });
    }
});
