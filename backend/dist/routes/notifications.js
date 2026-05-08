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
        const jwtPayload = req.jwtPayload;
        const tenantId = jwtPayload?.tenantId;
        const jwtId = jwtPayload?.id;
        const id = jwtId ?? parseInt(req.query.employee_id);
        if (!id || isNaN(id)) {
            res.status(400).json({ error: 'employee_id is required' });
            return;
        }
        // 1. Trigger the monitor to check for new updates from Odoo
        await requestMonitor_1.requestMonitor.checkUpdates(id, tenantId);
        // 2. Fetch from store
        const notifications = await notificationStore_1.notificationStore.getAll(tenantId, id);
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
exports.notificationsRouter.put('/:id/read', async (req, res) => {
    try {
        const tenantId = req.jwtPayload?.tenantId;
        const { id } = req.params;
        await notificationStore_1.notificationStore.markRead(tenantId, id);
        res.json({ success: true });
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to mark as read' });
    }
});
// Mark ALL as read for the authenticated employee
exports.notificationsRouter.put('/read-all', async (req, res) => {
    try {
        const jwtPayload = req.jwtPayload;
        const tenantId = jwtPayload?.tenantId;
        const jwtId = jwtPayload?.id;
        const employeeId = jwtId ?? parseInt(req.query.employee_id);
        if (!employeeId || isNaN(employeeId)) {
            res.status(400).json({ error: 'employee_id is required' });
            return;
        }
        await notificationStore_1.notificationStore.markAllRead(tenantId, employeeId);
        res.json({ success: true });
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to mark all notifications as read' });
    }
});
