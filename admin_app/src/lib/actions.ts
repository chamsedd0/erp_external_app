'use server';

import { api } from './api';
import type { TenantFormData, SubscriptionPlan } from './types';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

export async function createTenantAction(slug: string, data: TenantFormData) {
    await api.createTenant(slug, data);
    revalidatePath('/clients');
    redirect(`/clients/${slug}`);
}

export async function updateTenantAction(slug: string, data: Partial<TenantFormData>) {
    await api.updateTenant(slug, data);
    revalidatePath(`/clients/${slug}`);
    revalidatePath('/clients');
}

export async function deleteTenantAction(slug: string) {
    await api.deleteTenant(slug);
    revalidatePath('/clients');
    redirect('/clients');
}

export async function toggleEnabledAction(slug: string, enabled: boolean) {
    await api.updateTenant(slug, { enabled });
    revalidatePath(`/clients/${slug}`);
    revalidatePath('/clients');
}

export async function updateStatusAction(
    slug: string,
    status: 'trial' | 'active' | 'overdue' | 'suspended' | 'cancelled'
) {
    await api.updateTenant(slug, { subscription_status: status });
    revalidatePath(`/clients/${slug}`);
    revalidatePath('/clients');
    revalidatePath('/billing');
}

// ── Plan actions ──────────────────────────────────────────────────────────────

export async function createPlanAction(
    plan: Omit<SubscriptionPlan, 'created_at'>
): Promise<{ success: boolean; error?: string }> {
    try {
        await api.createPlan(plan);
        revalidatePath('/billing');
        return { success: true };
    } catch (e: any) {
        return { success: false, error: e.message ?? 'Failed to create plan' };
    }
}

export async function updatePlanAction(
    id: string,
    updates: Partial<SubscriptionPlan>
): Promise<{ success: boolean; error?: string }> {
    try {
        await api.updatePlan(id, updates);
        revalidatePath('/billing');
        return { success: true };
    } catch (e: any) {
        return { success: false, error: e.message ?? 'Failed to update plan' };
    }
}

export async function deletePlanAction(id: string) {
    await api.deletePlan(id);
    revalidatePath('/billing');
}

// ── Error log actions ─────────────────────────────────────────────────────────

export async function clearErrorsAction(slug: string) {
    await api.clearErrors(slug);
    revalidatePath(`/clients/${slug}`);
}
