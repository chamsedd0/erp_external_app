import { randomUUID } from 'crypto';
import { redisLPush, redisTrim } from './redis';

export interface AdminAuditEvent {
    id: string;
    timestamp: string;
    action: string;
    tenantId?: string;
    details?: Record<string, any>;
}

const AUDIT_KEY = 'shadow:admin:audit';
const TENANT_AUDIT_KEY = (tenantId: string) => `shadow:t:${tenantId}:admin_audit`;

export async function logAdminEvent(event: Omit<AdminAuditEvent, 'id' | 'timestamp'>): Promise<void> {
    const entry: AdminAuditEvent = {
        id: randomUUID(),
        timestamp: new Date().toISOString(),
        ...event,
    };
    const payload = JSON.stringify(entry);
    await Promise.resolve(redisLPush(AUDIT_KEY, payload)).catch(() => undefined);
    await Promise.resolve(redisTrim(AUDIT_KEY, 0, 999)).catch(() => undefined);

    if (event.tenantId) {
        await Promise.resolve(redisLPush(TENANT_AUDIT_KEY(event.tenantId), payload)).catch(() => undefined);
        await Promise.resolve(redisTrim(TENANT_AUDIT_KEY(event.tenantId), 0, 499)).catch(() => undefined);
    }
}
