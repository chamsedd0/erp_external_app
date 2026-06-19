import { Router } from 'express';
import { getOdooClient } from '../odoo/client';
import { tenantStore } from '../lib/tenantStore';
import { buildReadContext } from '../lib/authContext';
import { getModelSchema } from '../lib/schemaCache';

const router = Router();

// Source models whose custom fields the app actually renders. The relation
// target is derived from the field definition, NOT supplied by the client, so
// a crafted request cannot read an arbitrary model.
const ALLOWED_SOURCE_MODELS = new Set([
    'hr.expense',
    'maintenance.request',
    'hr.leave',
    'helpdesk.ticket',
    'account.analytic.line',
    'hr.attendance',
]);

const MAX_LIMIT = 100;

/**
 * GET /options?source_model=hr.expense&field=x_project&search=...&limit=&offset=
 *
 * Returns id/name options for the relation backing `field` on `source_model`.
 * The relation model is resolved from the live schema; results are
 * name-searched, company-scoped, and paginated.
 */
router.get('/', async (req, res) => {
    try {
        const tenantId = (req as any).jwtPayload?.tenantId as string;
        const tenantConfig = await tenantStore.getTenant(tenantId);
        if (!tenantConfig) return res.status(401).json({ error: 'Unknown tenant' });

        const sourceModel = String(req.query.source_model ?? '');
        const field = String(req.query.field ?? '');
        const search = String(req.query.search ?? '').trim();
        const limit = Math.min(parseInt(String(req.query.limit ?? '50'), 10) || 50, MAX_LIMIT);
        const offset = Math.max(parseInt(String(req.query.offset ?? '0'), 10) || 0, 0);

        if (!ALLOWED_SOURCE_MODELS.has(sourceModel)) {
            return res.status(400).json({ error: 'Unsupported source model', options: [] });
        }
        if (!field) {
            return res.status(400).json({ error: 'field is required', options: [] });
        }

        const client = getOdooClient(tenantId, tenantConfig);
        const uid = await client.authenticate();
        const ctx = await buildReadContext(req, client, uid);

        // Resolve the relation target from the field definition.
        const schema = await getModelSchema(tenantId, client, uid, sourceModel);
        const def = schema[field];
        if (!def || !def.relation) {
            return res.status(400).json({ error: 'Field is not a relation on this model', options: [] });
        }
        const relationModel = def.relation;

        // Name search domain (Odoo `name` ilike). Falls back to no domain if the
        // model has no name field (rare); company scoping comes from ctx.
        const domain = search ? [['name', 'ilike', search]] : [];

        let records: any = await client
            .searchRead(uid, relationModel, domain, ['id', 'display_name'], { silent: true, context: ctx, limit, offset })
            .catch(() =>
                client
                    .searchRead(uid, relationModel, domain, ['id', 'name'], { silent: true, context: ctx, limit, offset })
                    .catch(() => [])
            );

        const options = (Array.isArray(records) ? records : []).map((r: any) => ({
            id: r.id,
            name: r.display_name ?? r.name ?? String(r.id),
        }));
        res.json({ options, relation_model: relationModel });
    } catch (error: any) {
        console.error('Fetch Options Error:', error);
        res.json({ options: [], error: error.message });
    }
});

export const optionsRouter = router;
