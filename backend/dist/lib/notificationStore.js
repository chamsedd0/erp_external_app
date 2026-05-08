"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.notificationStore = void 0;
const redis_1 = require("./redis");
const REDIS_KEY = (tenantId) => `shadow:t:${tenantId}:notifications`;
async function readAll(tenantId) {
    try {
        const raw = await (0, redis_1.redisGet)(REDIS_KEY(tenantId));
        if (!raw)
            return [];
        return JSON.parse(raw);
    }
    catch (e) {
        console.error('notificationStore: failed to read from Redis', e);
        return [];
    }
}
async function writeAll(tenantId, notifications) {
    try {
        await (0, redis_1.redisSet)(REDIS_KEY(tenantId), JSON.stringify(notifications));
    }
    catch (e) {
        console.error('notificationStore: failed to write to Redis', e);
    }
}
exports.notificationStore = {
    /** Return all notifications for a specific employee. */
    getAll: async (tenantId, employeeId) => {
        const all = await readAll(tenantId);
        return all.filter(n => n.employeeId === employeeId);
    },
    /** Append a new notification. Trims the total list to the last 1 000 entries. */
    add: async (tenantId, notification) => {
        let all = await readAll(tenantId);
        all.push(notification);
        if (all.length > 1000)
            all = all.slice(all.length - 1000);
        await writeAll(tenantId, all);
    },
    /** Mark a single notification as read by its ID. */
    markRead: async (tenantId, id) => {
        const all = await readAll(tenantId);
        await writeAll(tenantId, all.map(n => (n.id === id ? { ...n, read: true } : n)));
    },
    /** Mark all notifications for a given employee as read. */
    markAllRead: async (tenantId, employeeId) => {
        const all = await readAll(tenantId);
        await writeAll(tenantId, all.map(n => n.employeeId === employeeId ? { ...n, read: true } : n));
    },
    /**
     * List all notifications for a tenant (admin view).
     * Returns newest-first, supports pagination.
     */
    listAllForTenant: async (tenantId, limit = 50, offset = 0) => {
        const all = await readAll(tenantId);
        const sorted = [...all].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        return {
            total: sorted.length,
            items: sorted.slice(offset, offset + limit),
        };
    },
};
