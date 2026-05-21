"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.relationId = relationId;
exports.companyCompatible = companyCompatible;
exports.getEmployeeCompanyId = getEmployeeCompanyId;
exports.withCompanyRequestability = withCompanyRequestability;
exports.requestableRecords = requestableRecords;
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
async function getEmployeeCompanyId(client, uid, employeeId) {
    const employees = await client.searchRead(uid, 'hr.employee', [['id', '=', employeeId]], ['company_id'], true);
    if (!Array.isArray(employees) || employees.length === 0)
        return null;
    return relationId(employees[0].company_id);
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
