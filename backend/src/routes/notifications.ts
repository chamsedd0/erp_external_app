import express from 'express';
import { notificationStore } from '../lib/notificationStore';
import { requestMonitor } from '../lib/requestMonitor';

export const notificationsRouter = express.Router();

// Get notifications (triggers a sync check first)
notificationsRouter.get('/', async (req, res) => {
    try {
        const jwtPayload = (req as any).jwtPayload;
        const tenantId = jwtPayload?.tenantId as string;
        const jwtId: number | undefined = jwtPayload?.id;
        const id: number = jwtId ?? parseInt(req.query.employee_id as string);
        if (!id || isNaN(id)) {
            res.status(400).json({ error: 'employee_id is required' });
            return;
        }

        // 1. Trigger the monitor to check for new updates from Odoo
        await requestMonitor.checkUpdates(id, tenantId);

        // 2. Fetch from store
        const notifications = await notificationStore.getAll(tenantId, id);

        // Sort by newest first
        notifications.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

        res.json({ notifications });
    } catch (error) {
        console.error('Error fetching notifications:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// Mark as read
notificationsRouter.put('/:id/read', async (req, res) => {
    try {
        const tenantId = (req as any).jwtPayload?.tenantId as string;
        const { id } = req.params;
        await notificationStore.markRead(tenantId, id);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Failed to mark as read' });
    }
});

// Mark ALL as read for the authenticated employee
notificationsRouter.put('/read-all', async (req, res) => {
    try {
        const jwtPayload = (req as any).jwtPayload;
        const tenantId = jwtPayload?.tenantId as string;
        const jwtId: number | undefined = jwtPayload?.id;
        const employeeId: number = jwtId ?? parseInt(req.query.employee_id as string);
        if (!employeeId || isNaN(employeeId)) {
            res.status(400).json({ error: 'employee_id is required' });
            return;
        }
        await notificationStore.markAllRead(tenantId, employeeId);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Failed to mark all notifications as read' });
    }
});
