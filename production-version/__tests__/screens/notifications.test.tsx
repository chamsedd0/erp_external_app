/**
 * Notifications screen logic tests.
 * Tests the getNotifications, markNotificationRead, markAllNotificationsRead API calls.
 */

jest.mock('@react-native-async-storage/async-storage');

import { apiClient } from '../../api/client';

const API_URL = 'https://erp-external-app.vercel.app';

function mockFetch(ok: boolean, body: any, status = 200) {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok,
        status,
        json: async () => body,
        text: async () => JSON.stringify(body),
    });
}

const SAMPLE_NOTIFICATIONS = [
    { id: 'n1', title: 'Leave approved', type: 'request_approved', read: false, timestamp: '2025-06-15T10:00:00Z' },
    { id: 'n2', title: 'Expense rejected', type: 'request_rejected', read: true, timestamp: '2025-06-14T09:00:00Z' },
];

beforeEach(() => jest.clearAllMocks());

// ─── getNotifications ─────────────────────────────────────────────────────────

describe('apiClient.getNotifications', () => {
    it('fetches notifications for an employee', async () => {
        mockFetch(true, { notifications: SAMPLE_NOTIFICATIONS });

        const result = await apiClient.getNotifications(42);

        expect(fetch).toHaveBeenCalledWith(
            `${API_URL}/notifications?employee_id=42`,
            expect.any(Object)
        );
        expect(result.notifications).toHaveLength(2);
    });

    it('throws on server error', async () => {
        mockFetch(false, { error: 'Internal Server Error' }, 500);
        await expect(apiClient.getNotifications(42)).rejects.toThrow('Internal Server Error');
    });
});

// ─── markNotificationRead ────────────────────────────────────────────────────

describe('apiClient.markNotificationRead', () => {
    it('sends PUT request to mark specific notification as read', async () => {
        mockFetch(true, { success: true });

        const result = await apiClient.markNotificationRead('n1');

        expect(fetch).toHaveBeenCalledWith(
            `${API_URL}/notifications/n1/read`,
            expect.objectContaining({ method: 'PUT' })
        );
        expect(result.success).toBe(true);
    });

    it('throws on failure', async () => {
        mockFetch(false, { error: 'Not found' }, 404);
        await expect(apiClient.markNotificationRead('bad-id')).rejects.toThrow('Not found');
    });
});

// ─── markAllNotificationsRead ─────────────────────────────────────────────────

describe('apiClient.markAllNotificationsRead', () => {
    it('sends PUT request to mark all notifications read', async () => {
        mockFetch(true, { success: true });

        await apiClient.markAllNotificationsRead();

        expect(fetch).toHaveBeenCalledWith(
            `${API_URL}/notifications/read-all`,
            expect.objectContaining({ method: 'PUT' })
        );
    });

    it('throws on server error', async () => {
        mockFetch(false, { error: 'Failed' }, 500);
        await expect(apiClient.markAllNotificationsRead()).rejects.toThrow('Failed');
    });
});

// ─── Notification sorting logic ───────────────────────────────────────────────

describe('Notification sorting (newest first)', () => {
    it('sorts notifications by timestamp descending', () => {
        // Mirror the sort logic from the notifications screen
        const notifs = [
            { id: 'old', timestamp: '2025-01-01T00:00:00Z', read: false },
            { id: 'new', timestamp: '2025-06-01T00:00:00Z', read: false },
            { id: 'mid', timestamp: '2025-03-15T00:00:00Z', read: false },
        ];
        const sorted = [...notifs].sort(
            (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
        );
        expect(sorted[0].id).toBe('new');
        expect(sorted[1].id).toBe('mid');
        expect(sorted[2].id).toBe('old');
    });

    it('handles notifications with same timestamp', () => {
        const ts = '2025-06-01T00:00:00Z';
        const notifs = [
            { id: 'a', timestamp: ts },
            { id: 'b', timestamp: ts },
        ];
        const sorted = [...notifs].sort(
            (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
        );
        expect(sorted).toHaveLength(2);
    });
});
