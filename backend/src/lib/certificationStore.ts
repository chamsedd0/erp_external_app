import { redisGet, redisLPush, redisLRange, redisSet, redisTrim } from './redis';

export type CertificationMode = 'safe' | 'write';
export type CertificationStatus = 'pass' | 'warn' | 'fail';
export type ScenarioStatus = 'pass' | 'warn' | 'fail' | 'skipped';

export interface CertificationEmployeeInput {
    label?: string;
    identifier: string;
    pin?: string;
    work_email?: string;
    login_method: 'barcode_pin' | 'employee_id_pin' | 'work_email_pin' | 'activation_invite';
}

export interface CertificationScenarioResult {
    id: string;
    label: string;
    group:
        | 'connection'
        | 'employee'
        | 'company'
        | 'schema'
        | 'picker'
        | 'preflight'
        | 'write'
        | 'attachment'
        | 'security';
    severity: 'blocking' | 'warning' | 'info';
    status: ScenarioStatus;
    employee_id?: number;
    request_type?: string;
    duration_ms: number;
    message?: string;
    details?: Record<string, any>;
}

export interface CertificationError {
    scenario_id: string;
    message: string;
    details?: Record<string, any>;
}

export interface CertificationRun {
    id: string;
    tenantId: string;
    mode: CertificationMode;
    status: CertificationStatus;
    started_at: string;
    finished_at?: string;
    odoo_version?: number | null;
    summary: {
        passed: number;
        warnings: number;
        failed: number;
        skipped: number;
        blocking_failures: number;
    };
    employees: Array<{
        label: string;
        employee_id?: number;
        login_ok: boolean;
        company_id?: number | null;
    }>;
    scenarios: CertificationScenarioResult[];
    sanitized_errors: CertificationError[];
}

export interface CertificationOverride {
    run_id: string;
    note: string;
    approved_at: string;
}

const latestKey = (tenantId: string) => `shadow:t:${tenantId}:certification:latest`;
const runKey = (tenantId: string, runId: string) => `shadow:t:${tenantId}:certification:${runId}`;
const runsKey = (tenantId: string) => `shadow:t:${tenantId}:certification:runs`;
const overrideKey = (tenantId: string, runId: string) => `shadow:t:${tenantId}:certification:override:${runId}`;

export const certificationStore = {
    async saveRun(run: CertificationRun): Promise<void> {
        const payload = JSON.stringify(run);
        await redisSet(runKey(run.tenantId, run.id), payload);
        await redisSet(latestKey(run.tenantId), payload);
        await redisLPush(runsKey(run.tenantId), run.id);
        await redisTrim(runsKey(run.tenantId), 0, 19);
    },

    async getLatest(tenantId: string): Promise<CertificationRun | null> {
        const raw = await redisGet(latestKey(tenantId));
        return raw ? JSON.parse(raw) as CertificationRun : null;
    },

    async getRun(tenantId: string, runId: string): Promise<CertificationRun | null> {
        const raw = await redisGet(runKey(tenantId, runId));
        return raw ? JSON.parse(raw) as CertificationRun : null;
    },

    async listRuns(tenantId: string): Promise<CertificationRun[]> {
        const ids = await redisLRange(runsKey(tenantId), 0, 19).catch(() => []);
        const uniqueIds = [...new Set(ids)];
        const runs = await Promise.all(uniqueIds.map(id => this.getRun(tenantId, id).catch(() => null)));
        return runs.filter((run): run is CertificationRun => Boolean(run));
    },

    async saveOverride(tenantId: string, runId: string, note: string): Promise<CertificationOverride> {
        const override: CertificationOverride = {
            run_id: runId,
            note,
            approved_at: new Date().toISOString(),
        };
        await redisSet(overrideKey(tenantId, runId), JSON.stringify(override));
        return override;
    },

    async getOverride(tenantId: string, runId: string): Promise<CertificationOverride | null> {
        const raw = await redisGet(overrideKey(tenantId, runId));
        return raw ? JSON.parse(raw) as CertificationOverride : null;
    },
};
