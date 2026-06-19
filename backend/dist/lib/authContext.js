"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getJwtPayload = getJwtPayload;
exports.getAuthenticatedEmployee = getAuthenticatedEmployee;
exports.getAuthenticatedEmployeeId = getAuthenticatedEmployeeId;
exports.getAuthenticatedTenantId = getAuthenticatedTenantId;
exports.getLang = getLang;
exports.getLangContext = getLangContext;
exports.buildReadContext = buildReadContext;
exports.buildOdooContext = buildOdooContext;
const odooCompatibility_1 = require("./odooCompatibility");
const odooCompatibility_2 = require("./odooCompatibility");
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
// ── Company + language context ─────────────────────────────────────────────────
//
// Business rule: one mobile account = one hr.employee = one res.company. The
// employee's company is ALWAYS derived server-side from the authenticated JWT
// employee id — never from a client-supplied header. There is no operating
// company switcher; an employee only ever sees/creates records for their own
// company.
const LANG_MAP = {
    ar: 'ar_001',
    en: 'en_US',
};
/** Odoo locale code derived from the X-Lang header (e.g. "ar" → "ar_001"). */
function getLang(req) {
    const raw = req.headers['x-lang'];
    const code = (Array.isArray(raw) ? raw[0] : raw)?.toString().trim().toLowerCase();
    if (!code)
        return undefined;
    return LANG_MAP[code] ?? (code.includes('_') ? code : undefined);
}
/**
 * Language-only context — no company scoping. Use only for reads that are not
 * company-specific (rare). Prefer buildReadContext for anything that returns
 * company-scoped records or options.
 */
function getLangContext(req) {
    const lang = getLang(req);
    return lang ? { lang } : {};
}
/**
 * Validated read/options context, scoped to the authenticated employee's own
 * company. Resolves the company from the JWT employee id (or an explicit
 * employeeId) and pins Odoo's allowed_company_ids/company_id to it, so list and
 * option endpoints can never leak another company's records. Adds UI language.
 *
 * Fails closed when the employee has no resolvable company. Falling back to the
 * integration user's default company can leak options in multi-company tenants.
 */
async function buildReadContext(req, client, uid, employeeId) {
    const lang = getLang(req);
    const empId = employeeId ?? getAuthenticatedEmployeeId(req, req.query?.employee_id);
    let companyId = null;
    try {
        companyId = await (0, odooCompatibility_2.getEmployeeCompanyId)(client, uid, empId);
    }
    catch {
        // handled below as a closed failure
    }
    if (!companyId) {
        throw Object.assign(new Error('Employee company is not configured. Please contact your administrator.'), { statusCode: 422, code: 'EMPLOYEE_COMPANY_REQUIRED' });
    }
    return {
        ...(0, odooCompatibility_1.companyContext)(companyId),
        ...(lang ? { lang } : {}),
    };
}
/**
 * Validated write context. Creates/writes always target the employee's own
 * company and return the pinned company context.
 *
 * Fails closed (422) when an employeeId is given but no company can be resolved,
 * mirroring buildReadContext. An unscoped write in a multi-company tenant could
 * land the record in the integration user's default company rather than the
 * employee's, so we refuse rather than guess. (Business rule: one mobile account
 * = one hr.employee = one res.company.)
 */
async function buildOdooContext(req, client, uid, employeeId) {
    const lang = getLang(req);
    let companyId = null;
    if (employeeId) {
        // selectedCompanyId is null: there is no switcher — always the employee's own company.
        const result = await (0, odooCompatibility_2.assertEmployeeCanUseCompany)(client, uid, employeeId, null);
        companyId = result.companyId;
        if (!companyId) {
            throw Object.assign(new Error('Employee company is not configured. Please contact your administrator.'), { statusCode: 422, code: 'EMPLOYEE_COMPANY_REQUIRED' });
        }
    }
    return {
        ...(0, odooCompatibility_1.companyContext)(companyId),
        ...(lang ? { lang } : {}),
    };
}
