import express from 'express';
import { notificationStore } from '../lib/notificationStore';
import { requestMonitor } from '../lib/requestMonitor';

export const notificationsRouter = express.Router();

// Get notifications (triggers a sync check first)
notificationsRouter.get('/', async (req, res) => {
    try {
        const employeeId = req.query.employee_id;
        if (!employeeId) {
            res.status(400).json({ error: 'employee_id is required' });
            return;
        }

        const id = parseInt(employeeId as string);

        // 1. Trigger the monitor to check for new updates from Odoo
        // We await this so the user gets the latest notifications immediately on pull-to-refresh
        await requestMonitor.checkUpdates(id);

        // 2. Fetch from store
        const notifications = notificationStore.getAll(id);

        // Sort by newest first
        notifications.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

        res.json({ notifications });
    } catch (error) {
        console.error('Error fetching notifications:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// Mark as read
notificationsRouter.put('/:id/read', (req, res) => {
    try {
        const { id } = req.params;
        notificationStore.markRead(id);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Failed to mark as read' });
    }
});
