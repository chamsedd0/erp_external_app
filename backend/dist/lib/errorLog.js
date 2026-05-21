"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.pushError = pushError;
exports.getErrors = getErrors;
exports.clearErrors = clearErrors;
const redis_1 = require("./redis");
const MAX_ERRORS = 100;
function key(tenantId) {
    return `shadow:t:${tenantId}:errors`;
}
/**
 * Prepend an error entry to the tenant's error log.
 * Silently swallows failures — error logging must never crash the app.
 */
async function pushError(tenantId, entry) {
    try {
        const k = key(tenantId);
        await (0, redis_1.redisLPush)(k, JSON.stringify(entry));
        // Keep only the 100 most recent entries (LPUSH prepends, so index 0 is newest)
        await (0, redis_1.redisTrim)(k, 0, MAX_ERRORS - 1);
    }
    catch { /* never crash on error logging */ }
}
/**
 * Retrieve all error log entries for a tenant (newest first).
 */
async function getErrors(tenantId) {
    try {
        const raw = await (0, redis_1.redisLRange)(key(tenantId), 0, -1);
        return raw.map(r => {
            try {
                return JSON.parse(r);
            }
            catch {
                return null;
            }
        }).filter(Boolean);
    }
    catch {
        return [];
    }
}
/**
 * Delete all error log entries for a tenant.
 */
async function clearErrors(tenantId) {
    try {
        await (0, redis_1.redisDel)(key(tenantId));
    }
    catch { /* ignore */ }
}
