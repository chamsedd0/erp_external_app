'use server';

import { api } from './api';
import type { TenantFormData } from './types';
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
