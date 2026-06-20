"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.companyContext = companyContext;
exports.relationId = relationId;
exports.companyCompatible = companyCompatible;
exports.companyAllowedStrict = companyAllowedStrict;
exports.companyDomain = companyDomain;
exports.getIntegrationCompanyIds = getIntegrationCompanyIds;
exports.getEmployeeCompanyId = getEmployeeCompanyId;
exports.getEmployeeAllowedCompanyIds = getEmployeeAllowedCompanyIds;
exports.assertEmployeeCanUseCompany = assertEmployeeCanUseCompany;
exports.withCompanyRequestability = withCompanyRequestability;
exports.requestableRecords = requestableRecords;
/**
 * Builds an Odoo `context` that scopes reads/writes to a single company.
 * Returns {} when no company is active so callers fall back to the integration
 * user's default company (backward compatible with older app builds).
 */
function companyContext(companyId) {
    return companyId ? { allowed_company_ids: [companyId], company_id: companyId } : {};
}
function relationId(value) {
    if (Array.isArray(value) && typeof value[0] === 'number')
        return value[0];
    if (typeof value === 'number')
        return value;
    return null;
}
function companyCompatible(recordCompany, employeeCompanyId) {
    if (!employeeCompanyId)
        return true;
    const recordCompanyId = relationId(recordCompany);
    return recordCompanyId === null || recordCompanyId === employeeCompanyId;
}
/**
 * Strict company filter for records whose `company_id` MUST be present to be
 * trusted. Unlike `companyCompatible`, a missing/undefined `company_id` is
 * treated as NOT compatible — so a record returned by a fallback query that
 * dropped the `company_id` field can never be silently accepted as "global".
 *
 * `hasCompanyField` indicates whether the query actually selected `company_id`;
 * when false (a degraded fallback that omitted the field) every record is
 * rejected, failing closed for the "one employee, one company" rule.
 */
function companyAllowedStrict(record, employeeCompanyId, hasCompanyField) {
    if (!employeeCompanyId)
        return true; // no company context → unchanged behavior
    if (!hasCompanyField)
        return false; // company unknown → fail closed
    if (!('company_id' in record))
        return false; // field missing on this record → fail closed
    const recordCompanyId = relationId(record.company_id);
    // false/empty company_id = a genuinely global record (shared) → allowed.
    return recordCompanyId === null || recordCompanyId === employeeCompanyId;
}
/**
 * Explicit company-scoping domain for an Odoo search_read.
 *
 * Odoo's `allowed_company_ids` context affects access/defaults but does NOT
 * reliably restrict which records `search_read` returns — multi-company
 * instances still return records from every company the integration user can
 * see. So company-scoped option lists must pass this domain explicitly.
 *
 * Returns records belonging to the employee's company OR with no company (global
 * records, e.g. shared products/projects). Empty when no company is known.
 */
function companyDomain(companyId) {
    return companyId ? ['|', ['company_id', '=', false], ['company_id', '=', companyId]] : [];
}
/** Companies the integration user may operate in, used only by admin/certification helpers. */
async function getIntegrationCompanyIds(client, uid) {
    const users = await client
        .searchRead(uid, 'res.users', [['id', '=', uid]], ['company_ids'], true)
        .catch(() => []);
    if (Array.isArray(users) && Array.isArray(users[0]?.company_ids) && users[0].company_ids.length) {
        return users[0].company_ids;
    }
    const all = await client.searchRead(uid, 'res.company', [], ['id'], true).catch(() => []);
    return Array.isArray(all) ? all.map((c) => c.id) : [];
}
async function getEmployeeCompanyId(client, uid, employeeId) {
    const employees = await client.searchRead(uid, 'hr.employee', [['id', '=', employeeId]], ['company_id'], true);
    if (!Array.isArray(employees) || employees.length === 0)
        return null;
    return relationId(employees[0].company_id);
}
async function getEmployeeAllowedCompanyIds(client, uid, employeeId) {
    const companyId = await getEmployeeCompanyId(client, uid, employeeId);
    return companyId ? [companyId] : [];
}
async function assertEmployeeCanUseCompany(client, uid, employeeId, selectedCompanyId) {
    const employeeCompanies = await getEmployeeAllowedCompanyIds(client, uid, employeeId).catch(() => []);
    const employeeCompanyId = employeeCompanies[0] ?? null;
    if (!selectedCompanyId) {
        return { companyId: employeeCompanyId, fallback: employeeCompanies.length === 0 };
    }
    if (employeeCompanies.length > 0 && !employeeCompanies.includes(selectedCompanyId)) {
        throw Object.assign(new Error('Selected company is not available for this employee.'), { statusCode: 422, code: 'EMPLOYEE_COMPANY_MISMATCH' });
    }
    if (employeeCompanies.length === 0) {
        const integrationCompanies = await getIntegrationCompanyIds(client, uid);
        if (integrationCompanies.length > 0 && !integrationCompanies.includes(selectedCompanyId)) {
            throw Object.assign(new Error('Selected company is not available.'), { statusCode: 422, code: 'INTEGRATION_COMPANY_MISMATCH' });
        }
        return { companyId: selectedCompanyId, fallback: true };
    }
    return { companyId: selectedCompanyId, fallback: false };
}
function withCompanyRequestability(records, employeeCompanyId, incompatibleReason) {
    return records.map(record => {
        const requestable = companyCompatible(record.company_id, employeeCompanyId);
        return {
            ...record,
            requestable,
            ...(requestable ? {} : { unavailable_reason: incompatibleReason }),
        };
    });
}
function requestableRecords(records) {
    return records.filter(record => record.requestable !== false);
}
