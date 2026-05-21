"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getTenantBillingSnapshot = getTenantBillingSnapshot;
const pushStore_1 = require("./pushStore");
async function getTenantBillingSnapshot(tenantId, tenant, plan) {
    const [devices, registeredUsers] = await Promise.all([
        Promise.resolve(pushStore_1.pushStore.listDevicesForTenant(tenantId) ?? []).catch(() => []),
        Promise.resolve(pushStore_1.pushStore.listRegisteredUsersForTenant(tenantId) ?? []).catch(() => []),
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
