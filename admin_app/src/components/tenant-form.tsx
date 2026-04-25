'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type { Tenant, TenantFormData } from '@/lib/types';
import { Input, Label, Textarea } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { createTenantAction, updateTenantAction } from '@/lib/actions';

interface Props {
    /** Editing an existing tenant — pre-filled */
    tenant?: Tenant;
    /** Creating a new one */
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
    monthly_amount: 0,
    enabled: true,
    notes: '',
};

export function TenantForm({ tenant, isNew = false }: Props) {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();
    const [slug, setSlug] = useState('');
    const [form, setForm] = useState<TenantFormData>({
        ...EMPTY,
        ...(tenant
            ? {
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
              }
            : {}),
    });
    const [error, setError] = useState('');
    const [testResult, setTestResult] = useState<string>('');
    const [testing, setTesting] = useState(false);

    function set<K extends keyof TenantFormData>(key: K, value: TenantFormData[K]) {
        setForm((prev) => ({ ...prev, [key]: value }));
    }

    async function testConnection() {
        const targetSlug = isNew ? slug : tenant!.slug;
        if (!targetSlug) { setTestResult('Enter a slug first'); return; }
        setTesting(true);
        setTestResult('');
        try {
            const res = await fetch(`/api/admin/health/${targetSlug}`);
            const data = await res.json();
            setTestResult(
                data.ok
                    ? `✅ Connected — Odoo v${data.odoo_version ?? '?'} (${data.latency_ms}ms)`
                    : `❌ Failed: ${data.error ?? 'Unreachable'}`
            );
        } catch {
            setTestResult('❌ Request failed');
        } finally {
            setTesting(false);
        }
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setError('');

        const payload = { ...form };
        // Don't send empty password on edit
        if (!isNew && !payload.odoo_password) {
            delete payload.odoo_password;
        }

        startTransition(async () => {
            try {
                if (isNew) {
                    if (!slug.trim()) { setError('Slug is required'); return; }
                    await createTenantAction(slug.trim(), payload);
                } else {
                    await updateTenantAction(tenant!.slug, payload);
                    router.push(`/clients/${tenant!.slug}`);
                }
            } catch (err: any) {
                setError(err.message ?? 'Something went wrong');
            }
        });
    }

    const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
        <Card>
            <CardHeader className="pb-2">
                <CardTitle className="text-sm">{title}</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {children}
            </CardContent>
        </Card>
    );

    const Field = ({
        label,
        id,
        span,
        children,
    }: {
        label: string;
        id: string;
        span?: boolean;
        children: React.ReactNode;
    }) => (
        <div className={span ? 'md:col-span-2' : ''}>
            <Label htmlFor={id}>{label}</Label>
            {children}
        </div>
    );

    return (
        <form onSubmit={handleSubmit} className="space-y-6">
            {isNew && (
                <Section title="Identity">
                    <Field label="Tenant Slug *" id="slug">
                        <Input
                            id="slug"
                            value={slug}
                            onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                            placeholder="e.g. acme-corp"
                            required
                        />
                        <p className="text-xs text-slate-400 mt-1">Lowercase, letters/numbers/hyphens only</p>
                    </Field>
                    <Field label="Company Name *" id="name">
                        <Input
                            id="name"
                            value={form.name}
                            onChange={(e) => set('name', e.target.value)}
                            placeholder="Acme Corporation"
                            required
                        />
                    </Field>
                </Section>
            )}

            {!isNew && (
                <div className="flex items-center gap-3 p-4 rounded-xl border border-slate-200 bg-slate-50">
                    <div>
                        <p className="text-sm font-medium text-slate-900">{tenant!.name}</p>
                        <p className="text-xs text-slate-400 font-mono">{tenant!.slug}</p>
                    </div>
                    <div className="ml-auto">
                        <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={form.enabled}
                                onChange={(e) => set('enabled', e.target.checked)}
                                className="rounded"
                            />
                            Enabled
                        </label>
                    </div>
                </div>
            )}

            {/* Connection */}
            <Section title="Odoo Connection">
                <Field label="Odoo URL *" id="odoo_url">
                    <Input
                        id="odoo_url"
                        type="url"
                        value={form.odoo_url}
                        onChange={(e) => set('odoo_url', e.target.value)}
                        placeholder="https://mycompany.odoo.com"
                        required
                    />
                </Field>
                <Field label="Database *" id="odoo_db">
                    <Input
                        id="odoo_db"
                        value={form.odoo_db}
                        onChange={(e) => set('odoo_db', e.target.value)}
                        placeholder="mycompany"
                        required
                    />
                </Field>
                <Field label="Username *" id="odoo_username">
                    <Input
                        id="odoo_username"
                        value={form.odoo_username ?? ''}
                        onChange={(e) => set('odoo_username', e.target.value)}
                        placeholder="admin@mycompany.com"
                        required={isNew}
                    />
                </Field>
                <Field label={isNew ? 'Password *' : 'Password (leave blank to keep)'} id="odoo_password">
                    <Input
                        id="odoo_password"
                        type="password"
                        value={form.odoo_password ?? ''}
                        onChange={(e) => set('odoo_password', e.target.value)}
                        placeholder={isNew ? 'Odoo user password' : '••••••••'}
                        required={isNew}
                    />
                </Field>
                <Field label="HR Email *" id="hr_email">
                    <Input
                        id="hr_email"
                        type="email"
                        value={form.hr_email}
                        onChange={(e) => set('hr_email', e.target.value)}
                        placeholder="hr@mycompany.com"
                        required
                    />
                </Field>
                <div className="flex items-end">
                    <button
                        type="button"
                        onClick={testConnection}
                        disabled={testing}
                        className="h-9 rounded-lg border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-50"
                    >
                        {testing ? 'Testing…' : 'Test Connection'}
                    </button>
                    {testResult && (
                        <span className="ml-3 text-sm">{testResult}</span>
                    )}
                </div>
            </Section>

            {/* Contact */}
            <Section title="Contact Information">
                <Field label="Contact Name *" id="contact_name">
                    <Input
                        id="contact_name"
                        value={form.contact_name}
                        onChange={(e) => set('contact_name', e.target.value)}
                        placeholder="Jane Smith"
                        required
                    />
                </Field>
                <Field label="Contact Email *" id="contact_email">
                    <Input
                        id="contact_email"
                        type="email"
                        value={form.contact_email}
                        onChange={(e) => set('contact_email', e.target.value)}
                        placeholder="jane@mycompany.com"
                        required
                    />
                </Field>
                <Field label="Contact Phone" id="contact_phone">
                    <Input
                        id="contact_phone"
                        type="tel"
                        value={form.contact_phone ?? ''}
                        onChange={(e) => set('contact_phone', e.target.value)}
                        placeholder="+1 555 000 0000"
                    />
                </Field>
            </Section>

            {/* Billing */}
            <Section title="Subscription & Billing">
                <Field label="Plan *" id="subscription_plan">
                    <Select
                        id="subscription_plan"
                        value={form.subscription_plan}
                        onChange={(e) =>
                            set('subscription_plan', e.target.value as TenantFormData['subscription_plan'])
                        }
                    >
                        <option value="starter">Starter</option>
                        <option value="professional">Professional</option>
                        <option value="enterprise">Enterprise</option>
                    </Select>
                </Field>
                <Field label="Status *" id="subscription_status">
                    <Select
                        id="subscription_status"
                        value={form.subscription_status}
                        onChange={(e) =>
                            set('subscription_status', e.target.value as TenantFormData['subscription_status'])
                        }
                    >
                        <option value="trial">Trial</option>
                        <option value="active">Active</option>
                        <option value="overdue">Overdue</option>
                        <option value="suspended">Suspended</option>
                        <option value="cancelled">Cancelled</option>
                    </Select>
                </Field>
                <Field label="Start Date *" id="subscription_start">
                    <Input
                        id="subscription_start"
                        type="date"
                        value={form.subscription_start}
                        onChange={(e) => set('subscription_start', e.target.value)}
                        required
                    />
                </Field>
                <Field label="Renewal Date *" id="subscription_renewal">
                    <Input
                        id="subscription_renewal"
                        type="date"
                        value={form.subscription_renewal}
                        onChange={(e) => set('subscription_renewal', e.target.value)}
                        required
                    />
                </Field>
                <Field label="Monthly Amount (USD) *" id="monthly_amount">
                    <Input
                        id="monthly_amount"
                        type="number"
                        min={0}
                        step={1}
                        value={form.monthly_amount}
                        onChange={(e) => set('monthly_amount', Number(e.target.value))}
                        required
                    />
                </Field>
            </Section>

            {/* Notes */}
            <Card>
                <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Internal Notes</CardTitle>
                </CardHeader>
                <CardContent>
                    <Textarea
                        id="notes"
                        value={form.notes ?? ''}
                        onChange={(e) => set('notes', e.target.value)}
                        placeholder="Any internal notes about this client…"
                        className="min-h-[100px]"
                    />
                </CardContent>
            </Card>

            {error && (
                <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
                    {error}
                </p>
            )}

            <div className="flex items-center gap-3">
                <Button type="submit" disabled={isPending}>
                    {isPending ? 'Saving…' : isNew ? 'Create Client' : 'Save Changes'}
                </Button>
                <Button
                    type="button"
                    variant="outline"
                    onClick={() => router.back()}
                    disabled={isPending}
                >
                    Cancel
                </Button>
            </div>
        </form>
    );
}
