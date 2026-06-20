/**
 * Builds an Odoo `context` that scopes reads/writes to a single company.
 * Returns {} when no company is active so callers fall back to the integration
 * user's default company (backward compatible with older app builds).
 */
export function companyContext(companyId: number | null): Record<string, any> {
    return companyId ? { allowed_company_ids: [companyId], company_id: companyId } : {};
}

export function relationId(value: any): number | null {
    if (Array.isArray(value) && typeof value[0] === 'number') return value[0];
    if (typeof value === 'number') return value;
    return null;
}

export function companyCompatible(recordCompany: any, employeeCompanyId: number | null): boolean {
    if (!employeeCompanyId) return true;
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
export function companyAllowedStrict(
    record: Record<string, any>,
    employeeCompanyId: number | null,
    hasCompanyField: boolean,
): boolean {
    if (!employeeCompanyId) return true;          // no company context → unchanged behavior
    if (!hasCompanyField) return false;           // company unknown → fail closed
    if (!('company_id' in record)) return false;  // field missing on this record → fail closed
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
export function companyDomain(companyId: number | null | undefined): any[] {
    return companyId ? ['|', ['company_id', '=', false], ['company_id', '=', companyId]] : [];
}

/** Companies the integration user may operate in, used only by admin/certification helpers. */
export async function getIntegrationCompanyIds(client: any, uid: number): Promise<number[]> {
    const users: any = await client
        .searchRead(uid, 'res.users', [['id', '=', uid]], ['company_ids'], true)
        .catch(() => []);
    if (Array.isArray(users) && Array.isArray(users[0]?.company_ids) && users[0].company_ids.length) {
        return users[0].company_ids as number[];
    }
    const all: any = await client.searchRead(uid, 'res.company', [], ['id'], true).catch(() => []);
    return Array.isArray(all) ? all.map((c: any) => c.id) : [];
}

export async function getEmployeeCompanyId(client: any, uid: number, employeeId: number): Promise<number | null> {
    const employees: any = await client.searchRead(
        uid,
        'hr.employee',
        [['id', '=', employeeId]],
        ['company_id'],
        true
    );
    if (!Array.isArray(employees) || employees.length === 0) return null;
    return relationId(employees[0].company_id);
}

export async function getEmployeeAllowedCompanyIds(client: any, uid: number, employeeId: number): Promise<number[]> {
    const companyId = await getEmployeeCompanyId(client, uid, employeeId);
    return companyId ? [companyId] : [];
}

export async function assertEmployeeCanUseCompany(
    client: any,
    uid: number,
    employeeId: number,
    selectedCompanyId: number | null,
): Promise<{ companyId: number | null; fallback: boolean }> {
    const employeeCompanies: number[] = await getEmployeeAllowedCompanyIds(client, uid, employeeId).catch(() => [] as number[]);
    const employeeCompanyId = employeeCompanies[0] ?? null;

    if (!selectedCompanyId) {
        return { companyId: employeeCompanyId, fallback: employeeCompanies.length === 0 };
    }

    if (employeeCompanies.length > 0 && !employeeCompanies.includes(selectedCompanyId)) {
        throw Object.assign(
            new Error('Selected company is not available for this employee.'),
            { statusCode: 422, code: 'EMPLOYEE_COMPANY_MISMATCH' }
        );
    }

    if (employeeCompanies.length === 0) {
        const integrationCompanies = await getIntegrationCompanyIds(client, uid);
        if (integrationCompanies.length > 0 && !integrationCompanies.includes(selectedCompanyId)) {
            throw Object.assign(
                new Error('Selected company is not available.'),
                { statusCode: 422, code: 'INTEGRATION_COMPANY_MISMATCH' }
            );
        }
        return { companyId: selectedCompanyId, fallback: true };
    }

    return { companyId: selectedCompanyId, fallback: false };
}

export function withCompanyRequestability<T extends Record<string, any>>(
    records: T[],
    employeeCompanyId: number | null,
    incompatibleReason: string
): Array<T & { requestable: boolean; unavailable_reason?: string }> {
    return records.map(record => {
        const requestable = companyCompatible(record.company_id, employeeCompanyId);
        return {
            ...record,
            requestable,
            ...(requestable ? {} : { unavailable_reason: incompatibleReason }),
        };
    });
}

export function requestableRecords<T extends Record<string, any>>(records: T[]): T[] {
    return records.filter(record => record.requestable !== false);
}
