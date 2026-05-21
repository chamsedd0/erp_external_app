import type { Request } from 'express';

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
