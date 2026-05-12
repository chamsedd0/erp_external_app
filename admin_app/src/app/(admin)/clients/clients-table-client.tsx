'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import type { Tenant } from '@/lib/types';
import { DSStatusBadge, DSPlanBadge, MonoChip, Th, DSTextInput, DSSelectInput } from '@/components/ui/primitives';
import { RenewalBadge } from '@/components/renewal-badge';
import { HealthCheck } from '@/components/health-check';
import { Search, Eye, Pencil, Building2 } from 'lucide-react';

const PLAN_ORDER: Record<string, number> = { starter: 0, professional: 1, enterprise: 2 };

type SortKey = 'name' | 'plan' | 'status' | 'renewal' | 'amount';

interface Props {
    tenants: Tenant[];
}

export function ClientsTableClient({ tenants }: Props) {
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState('');
    const [planFilter, setPlanFilter] = useState('');
    const [sortKey, setSortKey] = useState<SortKey>('name');
    const [sortAsc, setSortAsc] = useState(true);

    function toggleSort(key: SortKey) {
        if (sortKey === key) setSortAsc((a) => !a);
        else { setSortKey(key); setSortAsc(true); }
    }

    const filtered = useMemo(() => {
        let list = [...tenants];
        if (search) {
            const q = search.toLowerCase();
            list = list.filter(
                (t) =>
                    t.name.toLowerCase().includes(q) ||
                    t.slug.toLowerCase().includes(q) ||
                    t.contact_email.toLowerCase().includes(q)
            );
        }
        if (statusFilter) list = list.filter((t) => t.subscription_status === statusFilter);
        if (planFilter) list = list.filter((t) => t.subscription_plan === planFilter);

        list.sort((a, b) => {
            let cmp = 0;
            if (sortKey === 'name') cmp = a.name.localeCompare(b.name);
            else if (sortKey === 'plan') cmp = (PLAN_ORDER[a.subscription_plan] ?? 999) - (PLAN_ORDER[b.subscription_plan] ?? 999);
            else if (sortKey === 'status') cmp = a.subscription_status.localeCompare(b.subscription_status);
            else if (sortKey === 'renewal') {
                    // empty (draft) renewals sort last regardless of direction
                    if (!a.subscription_renewal && !b.subscription_renewal) cmp = 0;
                    else if (!a.subscription_renewal) cmp = 1;
                    else if (!b.subscription_renewal) cmp = -1;
                    else cmp = a.subscription_renewal.localeCompare(b.subscription_renewal);
                }
            else if (sortKey === 'amount') cmp = a.monthly_amount - b.monthly_amount;
            return sortAsc ? cmp : -cmp;
        });
        return list;
    }, [tenants, search, statusFilter, planFilter, sortKey, sortAsc]);

    const hasFilters = search || statusFilter || planFilter;

    const initials = (name: string) =>
        name.split(/\s+/).map((w) => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase();

    return (
        <>
            {/* Filters */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
                <div style={{ flex: '1 1 280px', maxWidth: 360 }}>
                    <DSTextInput
                        type="search"
                        placeholder="Search by name, slug, or email…"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        leftIcon={<Search size={14} />}
                    />
                </div>
                <div style={{ width: 165 }}>
                    <DSSelectInput
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                        options={[
                            { value: '', label: 'All statuses' },
                            { value: 'draft', label: 'Draft' },
                            { value: 'trial', label: 'Trial' },
                            { value: 'active', label: 'Active' },
                            { value: 'overdue', label: 'Overdue' },
                            { value: 'suspended', label: 'Suspended' },
                            { value: 'cancelled', label: 'Cancelled' },
                        ]}
                    />
                </div>
                <div style={{ width: 150 }}>
                    <DSSelectInput
                        value={planFilter}
                        onChange={(e) => setPlanFilter(e.target.value)}
                        options={[
                            { value: '', label: 'All plans' },
                            { value: 'starter', label: 'Starter' },
                            { value: 'professional', label: 'Professional' },
                            { value: 'enterprise', label: 'Enterprise' },
                        ]}
                    />
                </div>
                {hasFilters && (
                    <button
                        onClick={() => { setSearch(''); setStatusFilter(''); setPlanFilter(''); }}
                        style={{
                            background: 'none', border: 'none', cursor: 'pointer',
                            fontSize: 13, color: '#64748B', padding: '6px 8px',
                            fontFamily: 'inherit',
                        }}
                    >
                        Clear
                    </button>
                )}
                <div style={{ marginLeft: 'auto', fontSize: 13, color: '#94A3B8' }}>
                    {filtered.length} of {tenants.length}
                </div>
            </div>

            {/* Table or empty */}
            {filtered.length === 0 ? (
                <div style={{
                    background: '#fff', borderRadius: 12,
                    border: '1px solid #E2E8F0',
                    boxShadow: '0 1px 3px rgba(15,23,42,0.04)',
                    padding: '64px 20px', textAlign: 'center',
                }}>
                    <div style={{
                        display: 'inline-flex', width: 56, height: 56,
                        borderRadius: 12, background: '#F1F5F9', color: '#94A3B8',
                        alignItems: 'center', justifyContent: 'center', marginBottom: 14,
                    }}>
                        <Building2 size={26} />
                    </div>
                    <div style={{ fontSize: 16, fontWeight: 600, color: '#0F172A' }}>No clients found</div>
                    <div style={{ fontSize: 13, color: '#64748B', marginTop: 4 }}>
                        Try adjusting your filters or clear them to see all tenants.
                    </div>
                </div>
            ) : (
                <div style={{
                    background: '#fff', borderRadius: 12,
                    border: '1px solid #E2E8F0', overflow: 'hidden',
                    boxShadow: '0 1px 3px rgba(15,23,42,0.04)',
                }}>
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
                            <thead>
                                <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
                                    <Th label="Company"     active={sortKey === 'name'}    dir={sortAsc ? 'asc' : 'desc'} onClick={() => toggleSort('name')} />
                                    <Th label="Plan"        active={sortKey === 'plan'}    dir={sortAsc ? 'asc' : 'desc'} onClick={() => toggleSort('plan')} />
                                    <Th label="Status"      active={sortKey === 'status'}  dir={sortAsc ? 'asc' : 'desc'} onClick={() => toggleSort('status')} />
                                    <Th label="Renewal"     active={sortKey === 'renewal'} dir={sortAsc ? 'asc' : 'desc'} onClick={() => toggleSort('renewal')} />
                                    <Th label="MRR"         active={sortKey === 'amount'}  dir={sortAsc ? 'asc' : 'desc'} onClick={() => toggleSort('amount')} align="right" />
                                    <Th label="Odoo Health" />
                                    <Th label="" align="right" />
                                </tr>
                            </thead>
                            <tbody>
                                {filtered.map((t) => (
                                    <tr
                                        key={t.slug}
                                        className="row-hover"
                                        style={{ borderTop: '1px solid #F1F5F9' }}
                                    >
                                        {/* Company */}
                                        <td style={{ padding: '14px 16px' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                                <div style={{
                                                    width: 32, height: 32, borderRadius: 8,
                                                    background: '#F1F5F9', color: '#475569',
                                                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                                                    fontSize: 12, fontWeight: 600,
                                                }}>
                                                    {initials(t.name)}
                                                </div>
                                                <div style={{ minWidth: 0 }}>
                                                    <div style={{ fontWeight: 500, color: '#0F172A' }}>{t.name}</div>
                                                    <div style={{ marginTop: 2 }}><MonoChip size={12}>{t.slug}</MonoChip></div>
                                                </div>
                                            </div>
                                        </td>
                                        {/* Plan */}
                                        <td style={{ padding: '14px 16px' }}>
                                            <DSPlanBadge plan={t.subscription_plan} />
                                        </td>
                                        {/* Status */}
                                        <td style={{ padding: '14px 16px' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                                <DSStatusBadge status={t.subscription_status} />
                                                {!t.enabled && (
                                                    <span style={{ fontSize: 11, color: '#94A3B8' }}>(disabled)</span>
                                                )}
                                            </div>
                                        </td>
                                        {/* Renewal */}
                                        <td style={{ padding: '14px 16px' }}>
                                            <RenewalBadge date={t.subscription_renewal} />
                                        </td>
                                        {/* MRR */}
                                        <td style={{ padding: '14px 16px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: '#0F172A', fontWeight: 500 }}>
                                            ${t.monthly_amount.toLocaleString()}/mo
                                        </td>
                                        {/* Health */}
                                        <td style={{ padding: '14px 16px' }}>
                                            {t.subscription_status === 'draft'
                                                ? <span style={{ fontSize: 12, color: '#94A3B8' }}>Not activated</span>
                                                : <HealthCheck slug={t.slug} />
                                            }
                                        </td>
                                        {/* Actions */}
                                        <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                                <ActionLink href={`/clients/${t.slug}`} icon={<Eye size={13} />} label="View" />
                                                <ActionLink href={`/clients/${t.slug}/edit`} icon={<Pencil size={13} />} label="Edit" />
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </>
    );
}

function ActionLink({ href, icon, label }: { href: string; icon: React.ReactNode; label: string }) {
    const [hover, setHover] = useState(false);
    return (
        <Link
            href={href}
            onMouseEnter={() => setHover(true)}
            onMouseLeave={() => setHover(false)}
            style={{
                display: 'inline-flex', alignItems: 'center', gap: 4,
                padding: '4px 8px', borderRadius: 6,
                fontSize: 12, fontWeight: 500, color: '#475569',
                textDecoration: 'none',
                background: hover ? '#F1F5F9' : 'transparent',
                transition: 'background 100ms ease',
            }}
        >
            {icon}{label}
        </Link>
    );
}
