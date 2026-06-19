import { Router } from 'express';
import { getOdooClient } from '../odoo/client';
import { tenantStore } from '../lib/tenantStore';
import { getAuthenticatedEmployeeId } from '../lib/authContext';
import { getEmployeeCompanyId, relationId } from '../lib/odooCompatibility';

const router = Router();

// GET / — the authenticated employee's company.
// One mobile account maps to one hr.employee and one res.company. Never expose
// the integration user's broader multi-company access to the mobile app.
router.get('/', async (req, res) => {
    try {
        const tenantId = (req as any).jwtPayload?.tenantId as string;
        const tenantConfig = await tenantStore.getTenant(tenantId);
        if (!tenantConfig) return res.status(401).json({ error: 'Unknown tenant' });
        const client = getOdooClient(tenantId, tenantConfig);
        const uid = await client.authenticate();

        const empId = getAuthenticatedEmployeeId(req, req.query.employee_id);
        const defaultCompanyId = await getEmployeeCompanyId(client, uid, empId);
        if (!defaultCompanyId) {
            return res.status(422).json({
                error: 'Employee company is not configured. Please contact your administrator.',
                companies: [],
                default_company_id: null,
                fallback_company_scope: false,
            });
        }

        const companies: any = defaultCompanyId
            ? await client
                  .searchRead(uid, 'res.company', [['id', '=', defaultCompanyId]], ['id', 'name', 'currency_id'], true)
                  .catch(() => [])
            : [];

        const curIds = Array.from(
            new Set((companies || []).map((c: any) => relationId(c.currency_id)).filter(Boolean))
        ) as number[];
        const currencies: any = curIds.length
            ? await client
                  .searchRead(uid, 'res.currency', [['id', 'in', curIds]], ['id', 'name', 'symbol', 'position'], true)
                  .catch(() => [])
            : [];
        const curMap = new Map<number, any>((currencies || []).map((c: any) => [c.id, c]));

        const result = (companies || []).map((c: any) => {
            const cur = curMap.get(relationId(c.currency_id) ?? -1);
            return {
                id: c.id,
                name: c.name,
                currency: cur ? { id: cur.id, symbol: cur.symbol, position: cur.position } : null,
            };
        });
        res.json({ companies: result, default_company_id: defaultCompanyId, fallback_company_scope: false });
    } catch (error: any) {
        console.error('Fetch Companies Error:', error);
        res.status(500).json({ error: error.message });
    }
});

export const companiesRouter = router;
