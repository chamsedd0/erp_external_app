"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.notificationStore = void 0;
const crypto_1 = require("crypto");
const redis_1 = require("./redis");
const REDIS_KEY = (tenantId) => `shadow:t:${tenantId}:notifications`;
const REDIS_LIST_KEY = (tenantId) => `shadow:t:${tenantId}:notifications:list`;
async function readAll(tenantId) {
    try {
        const list = await Promise.resolve((0, redis_1.redisLRange)(REDIS_LIST_KEY(tenantId), 0, -1)).catch(() => []);
        if (Array.isArray(list) && list.length > 0) {
            return list
                .map(item => {
                try {
                    return JSON.parse(item);
                }
                catch {
                    return null;
                }
            })
                .filter((item) => item !== null);
        }
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
        const listKey = REDIS_LIST_KEY(tenantId);
        await Promise.resolve((0, redis_1.redisDel)(listKey)).catch(() => undefined);
        if (notifications.length > 0) {
            await Promise.resolve((0, redis_1.redisLPush)(listKey, ...[...notifications].reverse().map(n => JSON.stringify(n)))).catch(() => undefined);
            await Promise.resolve((0, redis_1.redisTrim)(listKey, 0, 999)).catch(() => undefined);
        }
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
        const safeNotification = {
            ...notification,
            id: notification.id || (0, crypto_1.randomUUID)(),
        };
        try {
            const existing = await readAll(tenantId);
            await Promise.resolve((0, redis_1.redisLPush)(REDIS_LIST_KEY(tenantId), JSON.stringify(safeNotification))).catch(() => undefined);
            await Promise.resolve((0, redis_1.redisTrim)(REDIS_LIST_KEY(tenantId), 0, 999)).catch(() => undefined);
            await (0, redis_1.redisSet)(REDIS_KEY(tenantId), JSON.stringify([...existing, safeNotification].slice(-1000)));
        }
        catch (e) {
            console.error('notificationStore: failed to append to Redis list', e);
            const all = await readAll(tenantId);
            await (0, redis_1.redisSet)(REDIS_KEY(tenantId), JSON.stringify([...all, safeNotification].slice(-1000)));
        }
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
