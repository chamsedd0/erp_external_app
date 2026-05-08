import { redisLPush, redisLRange, redisTrim, redisDel } from './redis';

const MAX_ERRORS = 100;

export interface ErrorLogEntry {
    timestamp: string;       // ISO
    method: string;          // 'GET' | 'POST' | ...
    path: string;            // '/expenses'
    status: number;          // 500
    error: string;           // error message (first 500 chars)
    employee_id?: number;    // from JWT payload
}

function key(tenantId: string): string {
    return `shadow:t:${tenantId}:errors`;
}

/**
 * Prepend an error entry to the tenant's error log.
 * Silently swallows failures — error logging must never crash the app.
 */
export async function pushError(tenantId: string, entry: ErrorLogEntry): Promise<void> {
    try {
        const k = key(tenantId);
        await redisLPush(k, JSON.stringify(entry));
        // Keep only the 100 most recent entries (LPUSH prepends, so index 0 is newest)
        await redisTrim(k, 0, MAX_ERRORS - 1);
    } catch { /* never crash on error logging */ }
}

/**
 * Retrieve all error log entries for a tenant (newest first).
 */
export async function getErrors(tenantId: string): Promise<ErrorLogEntry[]> {
    try {
        const raw = await redisLRange(key(tenantId), 0, -1);
        return raw.map(r => {
            try { return JSON.parse(r) as ErrorLogEntry; } catch { return null; }
        }).filter(Boolean) as ErrorLogEntry[];
    } catch {
        return [];
    }
}

/**
 * Delete all error log entries for a tenant.
 */
export async function clearErrors(tenantId: string): Promise<void> {
    try {
        await redisDel(key(tenantId));
    } catch { /* ignore */ }
}
