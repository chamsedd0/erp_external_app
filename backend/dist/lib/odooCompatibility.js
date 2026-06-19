"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.companyContext = companyContext;
exports.relationId = relationId;
exports.companyCompatible = companyCompatible;
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
