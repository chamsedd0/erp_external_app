import type { Request } from 'express';
import { companyContext } from './odooCompatibility';
import { assertEmployeeCanUseCompany } from './odooCompatibility';

export interface JwtEmployeePayload {
    id?: number;
    name?: string;
    role?: string;
    tenantId?: string;
}

export interface AuthenticatedEmployee {
    tenantId: string;
    employeeId: number;
    name?: string;
    role?: string;
}

export function getJwtPayload(req: Request): JwtEmployeePayload | null {
    return ((req as any).jwtPayload ?? null) as JwtEmployeePayload | null;
}

export function getAuthenticatedEmployee(req: Request): AuthenticatedEmployee {
    const payload = getJwtPayload(req);
    const tenantId = payload?.tenantId;
    const employeeId = Number(payload?.id);

    if (!tenantId || !Number.isInteger(employeeId) || employeeId <= 0) {
        throw Object.assign(new Error('Authenticated employee context required'), { statusCode: 401 });
    }

    return {
        tenantId,
        employeeId,
        name: payload?.name,
        role: payload?.role,
    };
}

export function getAuthenticatedEmployeeId(req: Request, fallback?: unknown): number {
    const payload = getJwtPayload(req);
    const jwtEmployeeId = Number(payload?.id);
    if (Number.isInteger(jwtEmployeeId) && jwtEmployeeId > 0) return jwtEmployeeId;

    const parsed = Number.parseInt(String(fallback ?? ''), 10);
    if (!Number.isInteger(parsed) || parsed <= 0) {
        throw Object.assign(new Error('employee_id query parameter required'), { statusCode: 400 });
    }
    return parsed;
}

export function getAuthenticatedTenantId(req: Request): string {
    const tenantId = getJwtPayload(req)?.tenantId;
    if (!tenantId) {
        throw Object.assign(new Error('Authenticated tenant context required'), { statusCode: 401 });
    }
    return tenantId;
}

// ── Operating company + language (sent by the app as request headers) ──────────

/** Active res.company chosen in the app's company switcher (X-Company-Id header). */
export function getActiveCompanyId(req: Request): number | null {
    const raw = req.headers['x-company-id'];
    const parsed = Number.parseInt(Array.isArray(raw) ? raw[0] : String(raw ?? ''), 10);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

const LANG_MAP: Record<string, string> = {
    ar: 'ar_001',
    en: 'en_US',
};

/** Odoo locale code derived from the X-Lang header (e.g. "ar" → "ar_001"). */
export function getLang(req: Request): string | undefined {
    const raw = req.headers['x-lang'];
    const code = (Array.isArray(raw) ? raw[0] : raw)?.toString().trim().toLowerCase();
    if (!code) return undefined;
    return LANG_MAP[code] ?? (code.includes('_') ? code : undefined);
}

/**
 * Combined Odoo context for a request: company scoping + UI language.
 * Pass this into searchRead/createRecord so reads are company-scoped and
 * Odoo-sourced labels come back localized.
 */
export function getOdooContext(req: Request): Record<string, any> {
    const lang = getLang(req);
    return {
        ...companyContext(getActiveCompanyId(req)),
        ...(lang ? { lang } : {}),
    };
}

export async function buildOdooContext(
    req: Request,
    client: any,
    uid: number,
    employeeId?: number,
): Promise<Record<string, any>> {
    const lang = getLang(req);
    let companyId = getActiveCompanyId(req);

    if (employeeId) {
        const result = await assertEmployeeCanUseCompany(client, uid, employeeId, companyId);
        companyId = result.companyId;
        if (result.fallback && companyId) {
            console.warn('[odoo-context] employee company could not be resolved; validated selected company against integration user only');
        }
    }

    return {
        ...companyContext(companyId),
        ...(lang ? { lang } : {}),
    };
}
