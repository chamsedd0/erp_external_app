"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.planStore = void 0;
const redis_1 = require("./redis");
const PLANS_KEY = 'shadow:plans';
const DEFAULT_PLANS = [
    {
        id: 'starter',
        name: 'Starter',
        max_employees: 10,
        billing_frequencies: ['monthly'],
        prices: { monthly: 199, quarterly: 179, yearly: 159 },
        support_tier: 'Email (48h)',
        custom_odoo_apps: false,
        is_active: true,
        created_at: '2025-01-01T00:00:00.000Z',
        pricing_model: 'fixed',
    },
    {
        id: 'professional',
        name: 'Professional',
        max_employees: 50,
        billing_frequencies: ['monthly', 'quarterly', 'yearly'],
        prices: { monthly: 599, quarterly: 549, yearly: 499 },
        support_tier: 'Priority (24h)',
        custom_odoo_apps: false,
        is_active: true,
        created_at: '2025-01-01T00:00:00.000Z',
        pricing_model: 'fixed',
    },
    {
        id: 'enterprise',
        name: 'Enterprise',
        max_employees: 0,
        billing_frequencies: ['monthly', 'quarterly', 'yearly'],
        prices: { monthly: 1499, quarterly: 1299, yearly: 1099 },
        support_tier: 'SLA (4h)',
        custom_odoo_apps: true,
        is_active: true,
        created_at: '2025-01-01T00:00:00.000Z',
        pricing_model: 'fixed',
    },
];
async function readPlans() {
    try {
        const raw = await (0, redis_1.redisGet)(PLANS_KEY);
        if (!raw)
            return DEFAULT_PLANS.map(p => ({ ...p }));
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : DEFAULT_PLANS.map(p => ({ ...p }));
    }
    catch {
        return DEFAULT_PLANS.map(p => ({ ...p }));
    }
}
exports.planStore = {
    listPlans: async () => {
        return readPlans();
    },
    getPlan: async (id) => {
        const plans = await readPlans();
        return plans.find(p => p.id === id) ?? null;
    },
    savePlan: async (plan) => {
        const plans = await readPlans();
        const idx = plans.findIndex(p => p.id === plan.id);
        if (idx >= 0) {
            plans[idx] = plan;
        }
        else {
            plans.push(plan);
        }
        await (0, redis_1.redisSet)(PLANS_KEY, JSON.stringify(plans));
    },
    /** Returns false if the plan was not found. */
    deletePlan: async (id) => {
        const plans = await readPlans();
        const idx = plans.findIndex(p => p.id === id);
        if (idx < 0)
            return false;
        plans.splice(idx, 1);
        await (0, redis_1.redisSet)(PLANS_KEY, JSON.stringify(plans));
        return true;
    },
};
