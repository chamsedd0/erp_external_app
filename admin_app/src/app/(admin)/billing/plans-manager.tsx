'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { createPlanAction, updatePlanAction, deletePlanAction } from '@/lib/actions';
import type { SubscriptionPlan } from '@/lib/types';
import { Plus, Pencil, Trash2, X, Check, Users, Zap } from 'lucide-react';

// ── Helpers ───────────────────────────────────────────────────────────────────

const FREQ_LABELS: Record<string, string> = {
    monthly: 'Monthly',
    quarterly: 'Quarterly',
    yearly: 'Yearly',
};

const EMPTY_PLAN: Omit<SubscriptionPlan, 'created_at'> = {
    id: '',
    name: '',
    max_employees: 10,
    billing_frequencies: ['monthly'],
    prices: { monthly: 0, quarterly: 0, yearly: 0 },
    support_tier: '',
    custom_odoo_apps: false,
    is_active: true,
    pricing_model: 'fixed',
    price_per_employee: 0,
};

// ── Plan form (used for create and edit) ──────────────────────────────────────

function PlanForm({
    initial,
    isNew,
    onSave,
    onCancel,
}: {
    initial: Omit<SubscriptionPlan, 'created_at'>;
    isNew: boolean;
    onSave: (plan: Omit<SubscriptionPlan, 'created_at'>) => void;
    onCancel: () => void;
}) {
    const [form, setForm] = useState(initial);

    function setField<K extends keyof typeof form>(k: K, v: typeof form[K]) {
        setForm(f => ({ ...f, [k]: v }));
    }

    function toggleFreq(freq: 'monthly' | 'quarterly' | 'yearly') {
        const cur = form.billing_frequencies;
        if (cur.includes(freq)) {
            if (cur.length === 1) return; // must have at least one
            setField('billing_frequencies', cur.filter(f => f !== freq));
        } else {
            setField('billing_frequencies', [...cur, freq] as any);
        }
    }

    return (
        <div style={{
            background: '#fff', border: '1px solid #E2E8F0', borderRadius: 12,
            padding: 20, marginBottom: 16,
        }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                {/* ID (new only) */}
                {isNew && (
                    <div>
                        <label style={labelStyle}>Plan ID <span style={{ color: '#94A3B8', fontSize: 11 }}>(slug, e.g. "growth")</span></label>
                        <input
                            value={form.id}
                            onChange={e => setField('id', e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'))}
                            placeholder="growth"
                            style={inputStyle}
                        />
                    </div>
                )}
                <div>
                    <label style={labelStyle}>Display Name</label>
                    <input value={form.name} onChange={e => setField('name', e.target.value)} placeholder="Growth" style={inputStyle} />
                </div>
                <div>
                    <label style={labelStyle}>Max Employees <span style={{ color: '#94A3B8', fontSize: 11 }}>(0 = unlimited)</span></label>
                    <input type="number" min={0} value={form.max_employees} onChange={e => setField('max_employees', parseInt(e.target.value) || 0)} style={inputStyle} />
                </div>
                <div>
                    <label style={labelStyle}>Support Tier</label>
                    <input value={form.support_tier} onChange={e => setField('support_tier', e.target.value)} placeholder="Priority (24h)" style={inputStyle} />
                </div>
            </div>

            {/* Pricing Model toggle */}
            <div style={{ marginTop: 12 }}>
                <label style={labelStyle}>Pricing Model</label>
                <div style={{ display: 'flex', gap: 8 }}>
                    {(['fixed', 'per_employee'] as const).map(model => (
                        <button
                            key={model} type="button"
                            onClick={() => {
                                setField('pricing_model', model);
                                if (model === 'per_employee') {
                                    setField('max_employees', 0); // unlimited when billing by headcount
                                }
                            }}
                            style={{
                                height: 32, padding: '0 14px', borderRadius: 6, fontSize: 12, fontWeight: 500,
                                background: form.pricing_model === model ? '#EFF6FF' : '#F8FAFC',
                                color: form.pricing_model === model ? '#2563EB' : '#64748B',
                                border: `1px solid ${form.pricing_model === model ? '#BFDBFE' : '#E2E8F0'}`,
                                cursor: 'pointer', fontFamily: 'inherit',
                            }}
                        >
                            {model === 'fixed' ? '● Fixed Price' : '○ Per Employee'}
                        </button>
                    ))}
                </div>
            </div>

            {/* Prices — only for fixed pricing */}
            {(form.pricing_model ?? 'fixed') === 'fixed' && (
                <div style={{ marginTop: 12 }}>
                    <label style={labelStyle}>Prices (USD/month equivalent)</label>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                        {(['monthly', 'quarterly', 'yearly'] as const).map(f => (
                            <div key={f}>
                                <div style={{ fontSize: 11, color: '#94A3B8', marginBottom: 3 }}>{FREQ_LABELS[f]}</div>
                                <input
                                    type="number" min={0}
                                    value={form.prices[f]}
                                    onChange={e => setField('prices', { ...form.prices, [f]: parseFloat(e.target.value) || 0 })}
                                    style={inputStyle}
                                />
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Per-employee rate — only for per_employee pricing */}
            {form.pricing_model === 'per_employee' && (
                <div style={{ marginTop: 12 }}>
                    <label style={labelStyle}>Price per employee per month (USD)</label>
                    <input
                        type="number" min={0} step={1}
                        value={form.price_per_employee ?? 0}
                        onChange={e => setField('price_per_employee', parseFloat(e.target.value) || 0)}
                        placeholder="e.g. 25"
                        style={{ ...inputStyle, maxWidth: 160 }}
                    />
                    <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 4 }}>
                        Monthly retainer = active employees × this rate. Calculated automatically at billing time.
                    </div>
                </div>
            )}

            {/* Billing frequencies */}
            <div style={{ marginTop: 12 }}>
                <label style={labelStyle}>Billing Frequencies</label>
                <div style={{ display: 'flex', gap: 8 }}>
                    {(['monthly', 'quarterly', 'yearly'] as const).map(f => (
                        <button
                            key={f} type="button"
                            onClick={() => toggleFreq(f)}
                            style={{
                                height: 30, padding: '0 12px', borderRadius: 6, fontSize: 12, fontWeight: 500,
                                background: form.billing_frequencies.includes(f) ? '#EFF6FF' : '#F8FAFC',
                                color: form.billing_frequencies.includes(f) ? '#2563EB' : '#94A3B8',
                                border: `1px solid ${form.billing_frequencies.includes(f) ? '#BFDBFE' : '#E2E8F0'}`,
                                cursor: 'pointer', fontFamily: 'inherit',
                            }}
                        >
                            {FREQ_LABELS[f]}
                        </button>
                    ))}
                </div>
            </div>

            {/* Toggles */}
            <div style={{ display: 'flex', gap: 16, marginTop: 12 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#475569', cursor: 'pointer' }}>
                    <input type="checkbox" checked={form.custom_odoo_apps} onChange={e => setField('custom_odoo_apps', e.target.checked)} />
                    Custom Odoo apps support
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#475569', cursor: 'pointer' }}>
                    <input type="checkbox" checked={form.is_active} onChange={e => setField('is_active', e.target.checked)} />
                    Active
                </label>
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
                <button
                    onClick={() => onSave(form)}
                    style={{
                        height: 32, padding: '0 14px', borderRadius: 6, fontSize: 13, fontWeight: 500,
                        background: '#0F172A', color: '#fff', border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                        display: 'inline-flex', alignItems: 'center', gap: 5,
                    }}
                >
                    <Check size={13} /> Save
                </button>
                <button
                    onClick={onCancel}
                    style={{
                        height: 32, padding: '0 12px', borderRadius: 6, fontSize: 13, fontWeight: 500,
                        background: '#F1F5F9', color: '#475569', border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                        display: 'inline-flex', alignItems: 'center', gap: 5,
                    }}
                >
                    <X size={13} /> Cancel
                </button>
            </div>
        </div>
    );
}

// ── Main component ────────────────────────────────────────────────────────────

export function PlansManager({ plans }: { plans: SubscriptionPlan[] }) {
    const [showNew, setShowNew] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [isPending, startTransition] = useTransition();
    const [error, setError] = useState<string | null>(null);
    const router = useRouter();

    function handleCreate(data: Omit<SubscriptionPlan, 'created_at'>) {
        if (!data.id || !data.name) { setError('Plan ID and name are required'); return; }
        setError(null);
        startTransition(async () => {
            const result = await createPlanAction(data);
            if (!result.success) { setError(result.error ?? 'Failed to create plan'); return; }
            setShowNew(false);
            router.refresh();
        });
    }

    function handleUpdate(id: string, plan: Omit<SubscriptionPlan, 'created_at'>) {
        setError(null);
        startTransition(async () => {
            const result = await updatePlanAction(id, plan);
            if (!result.success) { setError(result.error ?? 'Failed to update plan'); return; }
            setEditingId(null);
            router.refresh();
        });
    }

    function handleDelete(id: string, name: string) {
        if (!confirm(`Delete plan "${name}"? This cannot be undone.`)) return;
        setError(null);
        startTransition(async () => {
            try {
                await deletePlanAction(id);
                router.refresh();
            } catch (e: any) {
                setError(e.message ?? 'Failed to delete plan');
            }
        });
    }

    return (
        <div>
            {error && (
                <div style={{ background: '#FEF7F7', border: '1px solid #FECACA', borderRadius: 8, padding: '10px 14px', marginBottom: 12, fontSize: 13, color: '#991B1B' }}>
                    {error}
                </div>
            )}

            {/* Plan cards */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {plans.map(plan => (
                    editingId === plan.id ? (
                        <PlanForm
                            key={plan.id}
                            initial={plan}
                            isNew={false}
                            onSave={(data) => handleUpdate(plan.id, data)}
                            onCancel={() => setEditingId(null)}
                        />
                    ) : (
                        <div key={plan.id} style={{
                            background: plan.is_active ? '#fff' : '#F8FAFC',
                            border: '1px solid #E2E8F0', borderRadius: 10, padding: '14px 16px',
                            display: 'flex', alignItems: 'center', gap: 16, opacity: plan.is_active ? 1 : 0.6,
                        }}>
                            {/* Left: plan info */}
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <span style={{ fontSize: 14, fontWeight: 600, color: '#0F172A' }}>{plan.name}</span>
                                    <span style={{
                                        fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5,
                                        padding: '2px 6px', borderRadius: 4,
                                        background: plan.is_active ? '#DCFCE7' : '#F1F5F9',
                                        color: plan.is_active ? '#166534' : '#94A3B8',
                                    }}>
                                        {plan.is_active ? 'Active' : 'Inactive'}
                                    </span>
                                    <span style={{ fontSize: 10, color: '#94A3B8', fontFamily: 'monospace' }}>{plan.id}</span>
                                </div>
                                <div style={{ display: 'flex', gap: 16, marginTop: 4, flexWrap: 'wrap' }}>
                                    <span style={{ fontSize: 12, color: '#64748B', display: 'flex', alignItems: 'center', gap: 3 }}>
                                        <Users size={11} />
                                        {plan.max_employees === 0 ? 'Unlimited employees' : `Up to ${plan.max_employees} employees`}
                                    </span>
                                    <span style={{ fontSize: 12, color: '#64748B' }}>{plan.support_tier}</span>
                                    {plan.custom_odoo_apps && (
                                        <span style={{ fontSize: 12, color: '#7C3AED', display: 'flex', alignItems: 'center', gap: 3 }}>
                                            <Zap size={11} /> Custom Odoo apps
                                        </span>
                                    )}
                                </div>
                            </div>

                            {/* Center: prices */}
                            <div style={{ display: 'flex', gap: 12, textAlign: 'center', flexShrink: 0 }}>
                                {(plan.pricing_model ?? 'fixed') === 'per_employee' ? (
                                    <div>
                                        <div style={{ fontSize: 15, fontWeight: 700, color: '#2563EB', fontVariantNumeric: 'tabular-nums' }}>
                                            ${plan.price_per_employee ?? 0}
                                        </div>
                                        <div style={{ fontSize: 10, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: 0.5 }}>/ emp / mo</div>
                                    </div>
                                ) : (
                                    plan.billing_frequencies.map(f => (
                                        <div key={f}>
                                            <div style={{ fontSize: 15, fontWeight: 700, color: '#0F172A', fontVariantNumeric: 'tabular-nums' }}>
                                                ${plan.prices[f]}
                                            </div>
                                            <div style={{ fontSize: 10, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: 0.5 }}>{FREQ_LABELS[f]}</div>
                                        </div>
                                    ))
                                )}
                            </div>

                            {/* Right: actions */}
                            <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                                <button
                                    onClick={() => setEditingId(plan.id)}
                                    disabled={isPending}
                                    style={{
                                        width: 28, height: 28, borderRadius: 6, border: '1px solid #E2E8F0',
                                        background: '#F8FAFC', color: '#475569', cursor: 'pointer',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    }}
                                    title="Edit plan"
                                >
                                    <Pencil size={13} />
                                </button>
                                <button
                                    onClick={() => handleDelete(plan.id, plan.name)}
                                    disabled={isPending}
                                    style={{
                                        width: 28, height: 28, borderRadius: 6, border: '1px solid #FECACA',
                                        background: '#FEF7F7', color: '#DC2626', cursor: 'pointer',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    }}
                                    title="Delete plan"
                                >
                                    <Trash2 size={13} />
                                </button>
                            </div>
                        </div>
                    )
                ))}
            </div>

            {/* New plan form / button */}
            {showNew ? (
                <div style={{ marginTop: 8 }}>
                    <PlanForm
                        initial={EMPTY_PLAN}
                        isNew
                        onSave={handleCreate}
                        onCancel={() => { setShowNew(false); setError(null); }}
                    />
                </div>
            ) : (
                <button
                    onClick={() => setShowNew(true)}
                    style={{
                        marginTop: 10, height: 36, padding: '0 14px', borderRadius: 8,
                        background: '#F8FAFC', color: '#475569', border: '1px dashed #CBD5E1',
                        cursor: 'pointer', fontSize: 13, fontWeight: 500, fontFamily: 'inherit',
                        display: 'inline-flex', alignItems: 'center', gap: 6, width: '100%',
                        justifyContent: 'center',
                    }}
                >
                    <Plus size={14} /> New Plan
                </button>
            )}
        </div>
    );
}

// ── Shared styles ─────────────────────────────────────────────────────────────

const labelStyle: React.CSSProperties = {
    display: 'block', fontSize: 12, fontWeight: 500, color: '#475569', marginBottom: 4,
};

const inputStyle: React.CSSProperties = {
    width: '100%', height: 32, padding: '0 10px', borderRadius: 6,
    border: '1px solid #E2E8F0', fontSize: 13, color: '#0F172A',
    fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box',
};
