import { Router } from 'express';
import { getOdooClient } from '../odoo/client';
import { tenantStore } from '../lib/tenantStore';
import { getAuthenticatedEmployeeId } from '../lib/authContext';
import { getEmployeeAllowedCompanyIds, getEmployeeCompanyId, getIntegrationCompanyIds, relationId } from '../lib/odooCompatibility';

const router = Router();

// GET / — companies the integration user can operate in, plus the requesting
// employee's default company. Powers the in-app "Operating Company" switcher.
router.get('/', async (req, res) => {
    try {
        const tenantId = (req as any).jwtPayload?.tenantId as string;
        const tenantConfig = await tenantStore.getTenant(tenantId);
        if (!tenantConfig) return res.status(401).json({ error: 'Unknown tenant' });
        const client = getOdooClient(tenantId, tenantConfig);
        const uid = await client.authenticate();

        let defaultCompanyId: number | null = null;
        let fallbackCompanyScope = false;
        let companyIds: number[] = [];
        try {
            const empId = getAuthenticatedEmployeeId(req, req.query.employee_id);
            defaultCompanyId = await getEmployeeCompanyId(client, uid, empId);
            companyIds = await getEmployeeAllowedCompanyIds(client, uid, empId);
        } catch {
            // Older clients may call without employee context; keep a visible fallback.
        }

        // Fallback: every readable company (older Odoo / restricted user record)
        if (companyIds.length === 0) {
            fallbackCompanyScope = true;
            companyIds = await getIntegrationCompanyIds(client, uid);
        }

        const companies: any = companyIds.length
            ? await client
                  .searchRead(uid, 'res.company', [['id', 'in', companyIds]], ['id', 'name', 'currency_id'], true)
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
        
            // employee lookup optional — switcher still works without a default
        

        res.json({ companies: result, default_company_id: defaultCompanyId, fallback_company_scope: fallbackCompanyScope });
    } catch (error: any) {
        console.error('Fetch Companies Error:', error);
        res.status(500).json({ error: error.message });
    }
});

export const companiesRouter = router;
