"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getJwtPayload = getJwtPayload;
exports.getAuthenticatedEmployee = getAuthenticatedEmployee;
exports.getAuthenticatedEmployeeId = getAuthenticatedEmployeeId;
exports.getAuthenticatedTenantId = getAuthenticatedTenantId;
function getJwtPayload(req) {
    return (req.jwtPayload ?? null);
}
function getAuthenticatedEmployee(req) {
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
function getAuthenticatedEmployeeId(req, fallback) {
    const payload = getJwtPayload(req);
    const jwtEmployeeId = Number(payload?.id);
    if (Number.isInteger(jwtEmployeeId) && jwtEmployeeId > 0)
        return jwtEmployeeId;
    const parsed = Number.parseInt(String(fallback ?? ''), 10);
    if (!Number.isInteger(parsed) || parsed <= 0) {
        throw Object.assign(new Error('employee_id query parameter required'), { statusCode: 400 });
    }
    return parsed;
}
function getAuthenticatedTenantId(req) {
    const tenantId = getJwtPayload(req)?.tenantId;
    if (!tenantId) {
        throw Object.assign(new Error('Authenticated tenant context required'), { statusCode: 401 });
    }
    return tenantId;
}
