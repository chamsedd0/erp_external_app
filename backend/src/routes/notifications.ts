import express from 'express';
import { notificationStore } from '../lib/notificationStore';
import { requestMonitor } from '../lib/requestMonitor';

export const notificationsRouter = express.Router();

// Get notifications (triggers a sync check first)
notificationsRouter.get('/', async (req, res) => {
    try {
        // 2D: Always use the employee ID from the JWT payload so an authenticated
        // employee can only access their own notifications, never another employee's.
        // Fall back to query param for non-JWT contexts (dev/testing).
        const jwtId: number | undefined = (req as any).jwtPayload?.id;
        const id: number = jwtId ?? parseInt(req.query.employee_id as string);
        if (!id || isNaN(id)) {
            res.status(400).json({ error: 'employee_id is required' });
            return;
        }

        // 1. Trigger the monitor to check for new updates from Odoo
        await requestMonitor.checkUpdates(id);

        // 2. Fetch from store
        const notifications = await notificationStore.getAll(id);

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
        const { id } = req.params;
        await notificationStore.markRead(id);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Failed to mark as read' });
    }
});
