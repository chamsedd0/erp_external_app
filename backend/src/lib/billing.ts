import { TenantConfig } from './tenantStore';
import { SubscriptionPlan } from './planStore';
import { pushStore } from './pushStore';

export interface TenantBillingSnapshot {
    active_devices: number;
    registered_app_users: number;
    unassigned_devices: number;
    billing_monthly_amount: number;
    billing_source: 'fixed' | 'manual_override' | 'registered_app_users';
    price_per_employee?: number;
}

export async function getTenantBillingSnapshot(tenantId: string, tenant: TenantConfig, plan?: SubscriptionPlan | null): Promise<TenantBillingSnapshot> {
    const [devices, registeredUsers] = await Promise.all([
        Promise.resolve(pushStore.listDevicesForTenant(tenantId) ?? []).catch(() => []),
        Promise.resolve(pushStore.listRegisteredUsersForTenant(tenantId) ?? []).catch(() => []),
    ]);

    const registered_app_users = new Set(registeredUsers.map(user => user.employeeId)).size;
    const active_devices = devices.length;

    if (plan?.pricing_model === 'per_employee' && plan.price_per_employee) {
        if ((tenant.monthly_amount ?? 0) > 0) {
            return {
                active_devices,
                registered_app_users,
                unassigned_devices: 0,
                billing_monthly_amount: tenant.monthly_amount,
                billing_source: 'manual_override',
                price_per_employee: plan.price_per_employee,
            };
        }

        return {
            active_devices,
            registered_app_users,
            unassigned_devices: 0,
            billing_monthly_amount: registered_app_users * plan.price_per_employee,
            billing_source: 'registered_app_users',
            price_per_employee: plan.price_per_employee,
        };
    }

    return {
        active_devices,
        registered_app_users,
        unassigned_devices: 0,
        billing_monthly_amount: tenant.monthly_amount ?? 0,
        billing_source: 'fixed',
    };
}
