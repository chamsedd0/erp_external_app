import { getCustomFields } from '../../lib/schemaCache';

// Redis is not available in unit tests; force cache miss so getModelSchema
// falls through to the live client.getSchema mock.
jest.mock('../../lib/redis', () => ({
    redisGet: jest.fn().mockResolvedValue(null),
    redisSet: jest.fn().mockResolvedValue(undefined),
    redisDel: jest.fn().mockResolvedValue(undefined),
}));

function mockClientWithSchema(schema: Record<string, any>) {
    return {
        getSchema: jest.fn().mockResolvedValue(schema),
    } as any;
}

describe('getCustomFields — native field exclusion', () => {
    it('hides ALL custom many2ones on a timesheet line (native Project/Task cover it), keeps scalars', async () => {
        const client = mockClientWithSchema({
            x_project_id: { string: 'Project (custom)', type: 'many2one', relation: 'project.project', required: false, store: true, readonly: false },
            x_studio_ispc: { string: 'ISPC', type: 'many2one', relation: 'account.analytic.account', required: false, store: true, readonly: false },
            x_partner_id: { string: 'Partner', type: 'many2one', relation: 'res.partner', required: false, store: true, readonly: false },
            x_cost_center: { string: 'Cost Center', type: 'char', required: false, store: true, readonly: false },
        });

        const fields = await getCustomFields('t1', client, 1, 'account.analytic.line');

        // Every custom many2one is hidden; only the scalar survives.
        expect(Object.keys(fields)).toEqual(['x_cost_center']);
        expect(fields).not.toHaveProperty('x_project_id');
        expect(fields).not.toHaveProperty('x_studio_ispc');
        expect(fields).not.toHaveProperty('x_partner_id');
    });

    it('keeps a custom many2one with a non-dimension relation on a non-analytic model', async () => {
        const client = mockClientWithSchema({
            x_partner_id: { string: 'Partner', type: 'many2one', relation: 'res.partner', required: false, store: true, readonly: false },
        });

        const fields = await getCustomFields('t1', client, 1, 'hr.expense');

        expect(fields).toHaveProperty('x_partner_id');
    });

    it('hides a custom analytic-account many2one on any model (dimension relation)', async () => {
        const client = mockClientWithSchema({
            x_studio_dimension: { string: 'Cost Dimension', type: 'many2one', relation: 'account.analytic.account', required: false, store: true, readonly: false },
        });

        const fields = await getCustomFields('t1', client, 1, 'hr.expense');

        expect(fields).not.toHaveProperty('x_studio_dimension');
    });

    it('excludes readonly, non-stored, and unsupported-type custom fields', async () => {
        const client = mockClientWithSchema({
            x_computed: { string: 'Computed', type: 'char', required: false, store: false, readonly: true },
            x_readonly: { string: 'Readonly', type: 'char', required: false, store: true, readonly: true },
            x_binary: { string: 'Attachment', type: 'binary', required: false, store: true, readonly: false },
            x_note: { string: 'Note', type: 'text', required: false, store: true, readonly: false },
        });

        const fields = await getCustomFields('t1', client, 1, 'hr.expense');

        expect(Object.keys(fields)).toEqual(['x_note']);
    });

    it('hides a custom equipment many2one that duplicates the native Equipment selector', async () => {
        const client = mockClientWithSchema({
            x_equipment_id: { string: 'Equipment (custom)', type: 'many2one', relation: 'maintenance.equipment', required: false, store: true, readonly: false },
        });

        const fields = await getCustomFields('t1', client, 1, 'maintenance.request');

        expect(fields).not.toHaveProperty('x_equipment_id');
    });
});
