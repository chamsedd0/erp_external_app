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
