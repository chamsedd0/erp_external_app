import { redisGet, redisSet } from './redis';

export interface SubscriptionPlan {
    id: string;                                          // unique slug ('starter', 'professional', 'enterprise', or custom)
    name: string;
    max_employees: number;                               // 0 = unlimited
    billing_frequencies: Array<'monthly' | 'quarterly' | 'yearly'>;
    prices: { monthly: number; quarterly: number; yearly: number };
    support_tier: string;                                // e.g. 'Email (48h)', 'Priority (24h)', 'SLA (4h)'
    custom_odoo_apps: boolean;
    is_active: boolean;
    created_at: string;
}

const PLANS_KEY = 'shadow:plans';

const DEFAULT_PLANS: SubscriptionPlan[] = [
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
    },
];

async function readPlans(): Promise<SubscriptionPlan[]> {
    try {
        const raw = await redisGet(PLANS_KEY);
        if (!raw) return DEFAULT_PLANS.map(p => ({ ...p }));
        const parsed = JSON.parse(raw) as SubscriptionPlan[];
        return Array.isArray(parsed) ? parsed : DEFAULT_PLANS.map(p => ({ ...p }));
    } catch {
        return DEFAULT_PLANS.map(p => ({ ...p }));
    }
}

export const planStore = {
    listPlans: async (): Promise<SubscriptionPlan[]> => {
        return readPlans();
    },

    getPlan: async (id: string): Promise<SubscriptionPlan | null> => {
        const plans = await readPlans();
        return plans.find(p => p.id === id) ?? null;
    },

    savePlan: async (plan: SubscriptionPlan): Promise<void> => {
        const plans = await readPlans();
        const idx = plans.findIndex(p => p.id === plan.id);
        if (idx >= 0) {
            plans[idx] = plan;
        } else {
            plans.push(plan);
        }
        await redisSet(PLANS_KEY, JSON.stringify(plans));
    },

    /** Returns false if the plan was not found. */
    deletePlan: async (id: string): Promise<boolean> => {
        const plans = await readPlans();
        const idx = plans.findIndex(p => p.id === id);
        if (idx < 0) return false;
        plans.splice(idx, 1);
        await redisSet(PLANS_KEY, JSON.stringify(plans));
        return true;
    },
};
