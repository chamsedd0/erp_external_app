import { Router } from 'express';
import { notificationStore } from '../lib/notificationStore';
import { requestMonitor } from '../lib/requestMonitor';

const router = Router();

// GET / - Get all notifications for a user (triggers check)
router.get('/', async (req, res) => {
    try {
        const userId = req.query.user_id;
        if (!userId) {
            return res.status(400).json({ error: 'user_id required' });
        }

        const id = parseInt(userId as string);

        // Trigger check for new updates
        await requestMonitor.checkUpdates(id);

        // Fetch notifications
        const notifications = notificationStore.getUserNotifications(id);

        res.json({ notifications });
    } catch (error: any) {
        console.error('Get Notifications Error:', error);
        res.status(500).json({ error: error.message });
    }
});

// PUT /:id/read - Mark as read
router.put('/:id/read', (req, res) => {
    try {
        const { id } = req.params;
        const success = notificationStore.markRead(id);
        if (success) {
            res.json({ status: 'success' });
        } else {
            res.status(404).json({ error: 'Notification not found' });
        }
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

export const notificationsRouter = router;
