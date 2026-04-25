'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import type { Tenant } from '@/lib/types';
import { StatusBadge, PlanBadge } from '@/components/ui/badge';
import { RenewalBadge } from '@/components/renewal-badge';
import { HealthCheck } from '@/components/health-check';

const PLAN_ORDER = { starter: 0, professional: 1, enterprise: 2 };

type SortKey = 'name' | 'plan' | 'status' | 'renewal' | 'amount';

interface Props {
    tenants: Tenant[];
}

export function ClientsTableClient({ tenants }: Props) {
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState<string>('');
    const [planFilter, setPlanFilter] = useState<string>('');
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
                (t) => t.name.toLowerCase().includes(q) || t.slug.toLowerCase().includes(q)
            );
        }
        if (statusFilter) list = list.filter((t) => t.subscription_status === statusFilter);
        if (planFilter) list = list.filter((t) => t.subscription_plan === planFilter);

        list.sort((a, b) => {
            let cmp = 0;
            if (sortKey === 'name') cmp = a.name.localeCompare(b.name);
            else if (sortKey === 'plan') cmp = PLAN_ORDER[a.subscription_plan] - PLAN_ORDER[b.subscription_plan];
            else if (sortKey === 'status') cmp = a.subscription_status.localeCompare(b.subscription_status);
            else if (sortKey === 'renewal') cmp = a.subscription_renewal.localeCompare(b.subscription_renewal);
            else if (sortKey === 'amount') cmp = a.monthly_amount - b.monthly_amount;
            return sortAsc ? cmp : -cmp;
        });
        return list;
    }, [tenants, search, statusFilter, planFilter, sortKey, sortAsc]);

    function Th({ label, sort }: { label: string; sort?: SortKey }) {
        const active = sortKey === sort;
        return (
            <th
                scope="col"
                className={`px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wide ${sort ? 'cursor-pointer hover:text-slate-700 select-none' : ''}`}
                onClick={sort ? () => toggleSort(sort) : undefined}
            >
                {label}
                {active && <span className="ml-1">{sortAsc ? '↑' : '↓'}</span>}
            </th>
        );
    }

    return (
        <>
            {/* Filters */}
            <div className="flex flex-wrap items-center gap-3 mb-4">
                <input
                    type="search"
                    placeholder="Search by name or slug…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="h-9 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:border-transparent w-60"
                />
                <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="h-9 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:border-transparent"
                >
                    <option value="">All statuses</option>
                    <option value="active">Active</option>
                    <option value="trial">Trial</option>
                    <option value="overdue">Overdue</option>
                    <option value="suspended">Suspended</option>
                    <option value="cancelled">Cancelled</option>
                </select>
                <select
                    value={planFilter}
                    onChange={(e) => setPlanFilter(e.target.value)}
                    className="h-9 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:border-transparent"
                >
                    <option value="">All plans</option>
                    <option value="starter">Starter</option>
                    <option value="professional">Professional</option>
                    <option value="enterprise">Enterprise</option>
                </select>
                {(search || statusFilter || planFilter) && (
                    <button
                        onClick={() => { setSearch(''); setStatusFilter(''); setPlanFilter(''); }}
                        className="text-xs text-slate-500 hover:text-slate-700"
                    >
                        Clear filters
                    </button>
                )}
                <span className="ml-auto text-xs text-slate-400">{filtered.length} result{filtered.length !== 1 ? 's' : ''}</span>
            </div>

            {/* Table */}
            <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
                <table className="w-full text-sm">
                    <thead className="border-b border-slate-200 bg-slate-50">
                        <tr>
                            <Th label="Company" sort="name" />
                            <Th label="Plan" sort="plan" />
                            <Th label="Status" sort="status" />
                            <Th label="Renewal" sort="renewal" />
                            <Th label="MRR" sort="amount" />
                            <Th label="Odoo Health" />
                            <Th label="" />
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {filtered.length === 0 ? (
                            <tr>
                                <td colSpan={7} className="px-4 py-12 text-center text-sm text-slate-400">
                                    No clients found
                                </td>
                            </tr>
                        ) : (
                            filtered.map((t) => (
                                <tr key={t.slug} className="hover:bg-slate-50 transition-colors">
                                    <td className="px-4 py-3">
                                        <div className="font-medium text-slate-900">{t.name}</div>
                                        <div className="text-xs text-slate-400 font-mono">{t.slug}</div>
                                    </td>
                                    <td className="px-4 py-3">
                                        <PlanBadge plan={t.subscription_plan} />
                                    </td>
                                    <td className="px-4 py-3">
                                        <div className="flex items-center gap-1.5">
                                            <StatusBadge status={t.subscription_status} />
                                            {!t.enabled && (
                                                <span className="text-xs text-slate-400">(disabled)</span>
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-4 py-3">
                                        <RenewalBadge date={t.subscription_renewal} />
                                    </td>
                                    <td className="px-4 py-3 text-slate-700">
                                        ${t.monthly_amount.toLocaleString()}/mo
                                    </td>
                                    <td className="px-4 py-3">
                                        <HealthCheck slug={t.slug} />
                                    </td>
                                    <td className="px-4 py-3 text-right">
                                        <div className="flex items-center justify-end gap-2">
                                            <Link
                                                href={`/clients/${t.slug}`}
                                                className="text-xs font-medium text-slate-600 hover:text-slate-900"
                                            >
                                                View
                                            </Link>
                                            <Link
                                                href={`/clients/${t.slug}/edit`}
                                                className="text-xs font-medium text-slate-600 hover:text-slate-900"
                                            >
                                                Edit
                                            </Link>
                                        </div>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </>
    );
}
