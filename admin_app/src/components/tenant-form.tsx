'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type { Tenant, TenantFormData } from '@/lib/types';
import {
    DSCard,
    DSCardHeader,
    DSCardContent,
    DSField,
    DSTextInput,
    DSTextarea,
    DSSelectInput,
    Btn,
} from '@/components/ui/primitives';
import { createTenantAction, updateTenantAction } from '@/lib/actions';
import { Hash, Globe, Zap, CheckCircle2, AlertCircle } from 'lucide-react';

interface Props {
    tenant?: Tenant;
    isNew?: boolean;
}

const EMPTY: TenantFormData = {
    name: '',
    hr_email: '',
    odoo_url: '',
    odoo_db: '',
    odoo_username: '',
    odoo_password: '',
    contact_name: '',
    contact_email: '',
    contact_phone: '',
    subscription_plan: 'starter',
    subscription_status: 'trial',
    subscription_start: new Date().toISOString().slice(0, 10),
    subscription_renewal: '',
    monthly_amount: 199,
    enabled: true,
    notes: '',
};

const PLAN_DEFAULTS: Record<string, number> = {
    starter: 199, professional: 599, enterprise: 1499,
};

export function TenantForm({ tenant, isNew = false }: Props) {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();
    const [slug, setSlug] = useState('');
    const [form, setForm] = useState<TenantFormData>({
        ...EMPTY,
        ...(tenant ? {
            name: tenant.name,
            hr_email: tenant.hr_email,
            odoo_url: tenant.odoo_url,
            odoo_db: tenant.odoo_db,
            odoo_username: tenant.odoo_username ?? '',
            odoo_password: '',
            contact_name: tenant.contact_name,
            contact_email: tenant.contact_email,
            contact_phone: tenant.contact_phone ?? '',
            subscription_plan: tenant.subscription_plan,
            subscription_status: tenant.subscription_status,
            subscription_start: tenant.subscription_start,
            subscription_renewal: tenant.subscription_renewal,
            monthly_amount: tenant.monthly_amount,
            enabled: tenant.enabled,
            notes: tenant.notes ?? '',
        } : {}),
    });
    const [error, setError] = useState('');
    const [testing, setTesting] = useState(false);
    const [testResult, setTestResult] = useState<{ ok: boolean; text: string } | null>(null);

    function set<K extends keyof TenantFormData>(key: K, value: TenantFormData[K]) {
        setForm((prev) => ({ ...prev, [key]: value }));
    }

    async function testConnection() {
        const targetSlug = isNew ? slug : tenant!.slug;
        if (!targetSlug) { setTestResult({ ok: false, text: 'Enter a slug first' }); return; }
        setTesting(true);
        setTestResult(null);
        try {
            const res = await fetch(`/api/admin/health/${targetSlug}`);
            const data = await res.json();
            setTestResult(
                data.ok
                    ? { ok: true, text: `Connected — Odoo v${data.odoo_version ?? '?'} (${data.latency_ms}ms)` }
                    : { ok: false, text: `Failed: ${data.error ?? 'Unreachable'}` }
            );
        } catch {
            setTestResult({ ok: false, text: 'Request failed' });
        } finally {
            setTesting(false);
        }
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setError('');
        const payload = { ...form };
        if (!isNew && !payload.odoo_password) delete payload.odoo_password;
        if (!isNew && !payload.odoo_username) delete (payload as any).odoo_username;

        startTransition(async () => {
            try {
                if (isNew) {
                    if (!slug.trim()) { setError('Slug is required'); return; }
                    await createTenantAction(slug.trim(), payload);
                } else {
                    await updateTenantAction(tenant!.slug, payload);
                    router.push(`/clients/${tenant!.slug}`);
                }
            } catch (err: unknown) {
                setError(err instanceof Error ? err.message : 'Something went wrong');
            }
        });
    }

    const colSpan2: React.CSSProperties = { gridColumn: 'span 2' };

    return (
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 880 }}>
            {/* Identity (new only) */}
            {isNew && (
                <DSCard>
                    <DSCardHeader
                        title="Identity"
                        subtitle="Used in URLs and API tokens — cannot be changed later"
                    />
                    <DSCardContent>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                            <DSField label="Slug" required hint="Lowercase, hyphens — e.g. acme-industries">
                                <DSTextInput
                                    value={slug}
                                    onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                                    placeholder="acme-industries"
                                    leftIcon={<Hash size={14} />}
                                />
                            </DSField>
                            <DSField label="Company name" required>
                                <DSTextInput
                                    value={form.name}
                                    onChange={(e) => set('name', e.target.value)}
                                    placeholder="Acme Industries"
                                />
                            </DSField>
                        </div>
                    </DSCardContent>
                </DSCard>
            )}

            {/* Enabled toggle (edit only) */}
            {!isNew && tenant && (
                <div style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: '14px 16px', borderRadius: 12,
                    border: '1px solid #E2E8F0', background: '#F8FAFC',
                }}>
                    <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 14, fontWeight: 500, color: '#0F172A' }}>{tenant.name}</div>
                        <div style={{ fontSize: 12, fontFamily: 'monospace', color: '#94A3B8', marginTop: 2 }}>{tenant.slug}</div>
                    </div>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#475569', cursor: 'pointer' }}>
                        <input
                            type="checkbox"
                            checked={form.enabled}
                            onChange={(e) => set('enabled', e.target.checked)}
                            style={{ width: 14, height: 14, cursor: 'pointer' }}
                        />
                        Enabled
                    </label>
                </div>
            )}

            {/* Odoo Connection */}
            <DSCard>
                <DSCardHeader
                    title="Odoo Connection"
                    action={
                        <Btn
                            type="button"
                            variant="outline"
                            size="sm"
                            leftIcon={<Zap size={13} />}
                            onClick={testConnection}
                            disabled={testing}
                        >
                            {testing ? 'Testing…' : 'Test Connection'}
                        </Btn>
                    }
                />
                <DSCardContent>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                        <DSField label="Odoo URL" required>
                            <DSTextInput
                                type="url"
                                value={form.odoo_url}
                                onChange={(e) => set('odoo_url', e.target.value)}
                                placeholder="https://acme.odoo.com"
                                leftIcon={<Globe size={14} />}
                                required
                            />
                        </DSField>
                        <DSField label="Database" required>
                            <DSTextInput
                                value={form.odoo_db}
                                onChange={(e) => set('odoo_db', e.target.value)}
                                placeholder="acme_prod"
                                required
                            />
                        </DSField>
                        <DSField label="Username" required={isNew}>
                            <DSTextInput
                                value={form.odoo_username ?? ''}
                                onChange={(e) => set('odoo_username', e.target.value)}
                                placeholder="admin@acme.example"
                                required={isNew}
                            />
                        </DSField>
                        <DSField label={isNew ? 'Password' : 'Password (leave blank to keep)'} required={isNew}>
                            <DSTextInput
                                type="password"
                                value={form.odoo_password ?? ''}
                                onChange={(e) => set('odoo_password', e.target.value)}
                                placeholder={isNew ? 'Odoo user password' : '••••••••'}
                                required={isNew}
                            />
                        </DSField>
                        <div style={colSpan2}>
                            <DSField label="HR Email" hint="Where notification summaries are delivered">
                                <DSTextInput
                                    type="email"
                                    value={form.hr_email}
                                    onChange={(e) => set('hr_email', e.target.value)}
                                    placeholder="hr@acme.example"
                                />
                            </DSField>
                        </div>
                    </div>
                    {testResult && (
                        <div style={{
                            marginTop: 14, padding: '10px 12px',
                            background: testResult.ok ? '#ECFDF5' : '#FEF2F2',
                            border: `1px solid ${testResult.ok ? '#A7F3D0' : '#FECACA'}`,
                            color: testResult.ok ? '#065F46' : '#991B1B',
                            borderRadius: 8, fontSize: 13,
                            display: 'flex', alignItems: 'center', gap: 8,
                        }}>
                            {testResult.ok ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}
                            {testResult.text}
                        </div>
                    )}
                </DSCardContent>
            </DSCard>

            {/* Contact Info */}
            <DSCard>
                <DSCardHeader title="Contact Info" />
                <DSCardContent>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14 }}>
                        <DSField label="Contact name" required>
                            <DSTextInput
                                value={form.contact_name}
                                onChange={(e) => set('contact_name', e.target.value)}
                                placeholder="Sara Mendez"
                                required
                            />
                        </DSField>
                        <DSField label="Contact email" required>
                            <DSTextInput
                                type="email"
                                value={form.contact_email}
                                onChange={(e) => set('contact_email', e.target.value)}
                                placeholder="sara@acme.example"
                                required
                            />
                        </DSField>
                        <DSField label="Phone">
                            <DSTextInput
                                type="tel"
                                value={form.contact_phone ?? ''}
                                onChange={(e) => set('contact_phone', e.target.value)}
                                placeholder="+1 415 555 0102"
                            />
                        </DSField>
                    </div>
                </DSCardContent>
            </DSCard>

            {/* Subscription & Billing */}
            <DSCard>
                <DSCardHeader title="Subscription & Billing" />
                <DSCardContent>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
                        <DSField label="Plan">
                            <DSSelectInput
                                value={form.subscription_plan}
                                onChange={(e) => {
                                    const plan = e.target.value;
                                    set('subscription_plan', plan as TenantFormData['subscription_plan']);
                                    set('monthly_amount', PLAN_DEFAULTS[plan] ?? form.monthly_amount);
                                }}
                                options={[
                                    { value: 'starter', label: 'Starter — $199/mo' },
                                    { value: 'professional', label: 'Professional — $599/mo' },
                                    { value: 'enterprise', label: 'Enterprise — $1,499/mo' },
                                ]}
                            />
                        </DSField>
                        <DSField label="Status">
                            <DSSelectInput
                                value={form.subscription_status}
                                onChange={(e) => set('subscription_status', e.target.value as TenantFormData['subscription_status'])}
                                options={[
                                    { value: 'trial', label: 'Trial' },
                                    { value: 'active', label: 'Active' },
                                    { value: 'overdue', label: 'Overdue' },
                                    { value: 'suspended', label: 'Suspended' },
                                    { value: 'cancelled', label: 'Cancelled' },
                                ]}
                            />
                        </DSField>
                        <DSField label="Monthly amount (USD)">
                            <DSTextInput
                                type="number"
                                min={0}
                                step={1}
                                value={form.monthly_amount}
                                onChange={(e) => set('monthly_amount', Number(e.target.value))}
                            />
                        </DSField>
                        <DSField label="Start date" required>
                            <DSTextInput
                                type="date"
                                value={form.subscription_start}
                                onChange={(e) => set('subscription_start', e.target.value)}
                                required
                            />
                        </DSField>
                        <DSField label="Renewal date" required>
                            <DSTextInput
                                type="date"
                                value={form.subscription_renewal}
                                onChange={(e) => set('subscription_renewal', e.target.value)}
                                required
                            />
                        </DSField>
                    </div>
                </DSCardContent>
            </DSCard>

            {/* Notes */}
            <DSCard>
                <DSCardHeader title="Internal Notes" subtitle="Visible only to platform admins" />
                <DSCardContent>
                    <DSTextarea
                        value={form.notes ?? ''}
                        onChange={(e) => set('notes', e.target.value)}
                        placeholder="Anything worth remembering — payment quirks, escalation contacts, contract terms…"
                        style={{ minHeight: 100 }}
                    />
                </DSCardContent>
            </DSCard>

            {/* Error */}
            {error && (
                <div style={{
                    background: '#FEF2F2', border: '1px solid #FECACA',
                    color: '#B91C1C', padding: '10px 14px',
                    borderRadius: 8, fontSize: 13,
                    display: 'flex', alignItems: 'center', gap: 8,
                }}>
                    <AlertCircle size={14} />{error}
                </div>
            )}

            {/* Submit / Cancel */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, paddingBottom: 32 }}>
                <Btn
                    type="button"
                    variant="secondary"
                    onClick={() => router.back()}
                    disabled={isPending}
                >
                    Cancel
                </Btn>
                <Btn type="submit" disabled={isPending}>
                    {isPending ? 'Saving…' : isNew ? 'Create client' : 'Save changes'}
                </Btn>
            </div>
        </form>
    );
}
