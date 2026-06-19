import type { Request } from 'express';
import { buildReadContext, buildOdooContext } from '../../lib/authContext';

/**
 * Mock Odoo client whose hr.employee company lookup is configurable.
 * `companyId === null` simulates an employee with no resolvable company.
 */
function mockClient(companyId: number | null) {
    return {
        searchRead: jest.fn().mockImplementation(async (_uid: number, model: string) => {
            if (model === 'hr.employee') {
                return companyId == null ? [] : [{ id: 42, company_id: [companyId, 'Co'] }];
            }
            // res.users / res.company fallbacks used by integration-company lookups
            return [];
        }),
    } as any;
}

function fakeReq(headers: Record<string, any> = {}): Request {
    return { headers, query: {} } as any;
}

describe('buildReadContext — employee-company scoping', () => {
    it('pins allowed_company_ids + company_id to the employee company', async () => {
        const ctx = await buildReadContext(fakeReq(), mockClient(7), 1, 42);
        expect(ctx).toMatchObject({ allowed_company_ids: [7], company_id: 7 });
    });

    it('includes lang from X-Lang header', async () => {
        const ctx = await buildReadContext(fakeReq({ 'x-lang': 'ar' }), mockClient(7), 1, 42);
        expect(ctx.lang).toBe('ar_001');
    });

    it('fails closed (422) when the employee has no resolvable company', async () => {
        await expect(buildReadContext(fakeReq(), mockClient(null), 1, 42))
            .rejects.toMatchObject({ statusCode: 422, code: 'EMPLOYEE_COMPANY_REQUIRED' });
    });
});

describe('buildOdooContext — write-context scoping', () => {
    it('pins the company to the employee company for writes', async () => {
        const ctx = await buildOdooContext(fakeReq(), mockClient(7), 1, 42);
        expect(ctx).toMatchObject({ allowed_company_ids: [7], company_id: 7 });
    });

    it('fails closed (422) when an employee has no resolvable company (no unscoped writes)', async () => {
        await expect(buildOdooContext(fakeReq(), mockClient(null), 1, 42))
            .rejects.toMatchObject({ statusCode: 422, code: 'EMPLOYEE_COMPANY_REQUIRED' });
    });

    it('returns language-only context when no employeeId is provided', async () => {
        const ctx = await buildOdooContext(fakeReq({ 'x-lang': 'en' }), mockClient(7), 1);
        expect(ctx).toEqual({ lang: 'en_US' });
    });
});
