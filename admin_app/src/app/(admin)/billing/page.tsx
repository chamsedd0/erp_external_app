import Link from 'next/link';
import { api } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StatusBadge, PlanBadge } from '@/components/ui/badge';
import { RenewalBadge } from '@/components/renewal-badge';
import { BillingActions } from './billing-actions';

export const metadata = { title: 'Billing — Shadow Portal Admin' };

export default async function BillingPage() {
    const [tenants, stats] = await Promise.all([
        api.listTenants().catch(() => [] as Awaited<ReturnType<typeof api.listTenants>>),
        api.getPlatformStats().catch(() => null),
    ]);

    const now = new Date();
    const in30 = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    const overdue = tenants.filter((t) => t.subscription_status === 'overdue');
    const upcoming = tenants
        .filter((t) => {
            if (!t.subscription_renewal) return false;
            const d = new Date(t.subscription_renewal);
            return d >= now && d <= in30 && t.subscription_status !== 'cancelled';
        })
        .sort((a, b) => a.subscription_renewal.localeCompare(b.subscription_renewal));

    const mrr = tenants
        .filter((t) => t.subscription_status === 'active' || t.subscription_status === 'trial')
        .reduce((sum, t) => sum + t.monthly_amount, 0);

    const overdueAmount = overdue.reduce((sum, t) => sum + t.monthly_amount, 0);
    const dueThisWeek = tenants.filter((t) => {
        if (!t.subscription_renewal) return false;
        const d = new Date(t.subscription_renewal);
        const in7 = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
        return d >= now && d <= in7;
    });

    return (
        <div className="p-8 max-w-6xl mx-auto">
            <div className="mb-8">
                <h1 className="text-2xl font-bold text-slate-900">Billing</h1>
                <p className="text-sm text-slate-500 mt-0.5">Subscription overview and payment tracking</p>
            </div>

            {/* Summary cards */}
            <div className="grid grid-cols-3 gap-4 mb-8">
                <Card>
                    <CardContent className="pt-5 pb-5">
                        <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">
                            Monthly Revenue
                        </p>
                        <p className="text-3xl font-bold text-blue-600 mt-1">
                            ${mrr.toLocaleString()}
                        </p>
                        <p className="text-xs text-slate-400 mt-1">active + trial</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="pt-5 pb-5">
                        <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">
                            Overdue Amount
                        </p>
                        <p className={`text-3xl font-bold mt-1 ${overdueAmount > 0 ? 'text-red-600' : 'text-slate-900'}`}>
                            {overdueAmount > 0 ? `$${overdueAmount.toLocaleString()}` : '$0'}
                        </p>
                        <p className="text-xs text-slate-400 mt-1">{overdue.length} account{overdue.length !== 1 ? 's' : ''}</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="pt-5 pb-5">
                        <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">
                            Due This Week
                        </p>
                        <p className={`text-3xl font-bold mt-1 ${dueThisWeek.length > 0 ? 'text-amber-600' : 'text-slate-900'}`}>
                            {dueThisWeek.length}
                        </p>
                        <p className="text-xs text-slate-400 mt-1">renewal{dueThisWeek.length !== 1 ? 's' : ''} in 7 days</p>
                    </CardContent>
                </Card>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                {/* Overdue accounts */}
                <Card>
                    <CardHeader>
                        <CardTitle>Overdue Accounts</CardTitle>
                        {overdue.length > 0 && (
                            <span className="text-xs bg-red-100 text-red-700 rounded-full px-2 py-0.5 font-medium">
                                {overdue.length} account{overdue.length !== 1 ? 's' : ''}
                            </span>
                        )}
                    </CardHeader>
                    <CardContent>
                        {overdue.length === 0 ? (
                            <p className="text-sm text-slate-400 py-4 text-center">
                                No overdue accounts ✓
                            </p>
                        ) : (
                            <div className="space-y-3">
                                {overdue.map((t) => {
                                    const overdueDate = new Date(t.subscription_renewal);
                                    const daysOverdue = Math.floor(
                                        (now.getTime() - overdueDate.getTime()) / (1000 * 60 * 60 * 24)
                                    );
                                    return (
                                        <div
                                            key={t.slug}
                                            className="rounded-lg border border-red-200 bg-red-50 p-3"
                                        >
                                            <div className="flex items-start justify-between gap-2">
                                                <div>
                                                    <Link
                                                        href={`/clients/${t.slug}`}
                                                        className="text-sm font-medium text-slate-900 hover:underline"
                                                    >
                                                        {t.name}
                                                    </Link>
                                                    <p className="text-xs text-slate-500 mt-0.5">
                                                        {t.contact_name} · {t.contact_email}
                                                    </p>
                                                    <p className="text-xs text-red-600 mt-0.5">
                                                        {daysOverdue > 0 ? `${daysOverdue}d overdue` : 'Due today'}
                                                    </p>
                                                </div>
                                                <div className="text-right shrink-0">
                                                    <p className="text-sm font-semibold text-slate-900">
                                                        ${t.monthly_amount.toLocaleString()}
                                                    </p>
                                                    <PlanBadge plan={t.subscription_plan} />
                                                </div>
                                            </div>
                                            <BillingActions slug={t.slug} />
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Upcoming renewals */}
                <Card>
                    <CardHeader>
                        <CardTitle>Upcoming Renewals</CardTitle>
                        <span className="text-xs text-slate-400">Next 30 days</span>
                    </CardHeader>
                    <CardContent>
                        {upcoming.length === 0 ? (
                            <p className="text-sm text-slate-400 py-4 text-center">
                                No renewals in the next 30 days ✓
                            </p>
                        ) : (
                            <div className="divide-y divide-slate-100">
                                {upcoming.map((t) => (
                                    <div key={t.slug} className="flex items-center justify-between py-3 gap-3">
                                        <div>
                                            <Link
                                                href={`/clients/${t.slug}`}
                                                className="text-sm font-medium text-slate-900 hover:underline"
                                            >
                                                {t.name}
                                            </Link>
                                            <div className="flex items-center gap-1.5 mt-0.5">
                                                <PlanBadge plan={t.subscription_plan} />
                                                <span className="text-xs text-slate-500">
                                                    ${t.monthly_amount.toLocaleString()}/mo
                                                </span>
                                            </div>
                                        </div>
                                        <RenewalBadge date={t.subscription_renewal} />
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* All clients table */}
            <div className="mt-6">
                <Card>
                    <CardHeader>
                        <CardTitle>All Subscriptions</CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                        <table className="w-full text-sm">
                            <thead className="border-b border-slate-200 bg-slate-50">
                                <tr>
                                    {['Company', 'Plan', 'Status', 'Renewal', 'MRR'].map((h) => (
                                        <th
                                            key={h}
                                            className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wide"
                                        >
                                            {h}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {tenants
                                    .filter((t) => t.subscription_status !== 'cancelled')
                                    .sort((a, b) => a.subscription_renewal.localeCompare(b.subscription_renewal))
                                    .map((t) => (
                                        <tr key={t.slug} className="hover:bg-slate-50">
                                            <td className="px-4 py-3">
                                                <Link
                                                    href={`/clients/${t.slug}`}
                                                    className="font-medium text-slate-900 hover:underline"
                                                >
                                                    {t.name}
                                                </Link>
                                                <p className="text-xs text-slate-400">{t.contact_email}</p>
                                            </td>
                                            <td className="px-4 py-3">
                                                <PlanBadge plan={t.subscription_plan} />
                                            </td>
                                            <td className="px-4 py-3">
                                                <StatusBadge status={t.subscription_status} />
                                            </td>
                                            <td className="px-4 py-3">
                                                <RenewalBadge date={t.subscription_renewal} />
                                            </td>
                                            <td className="px-4 py-3 text-slate-700 font-medium">
                                                ${t.monthly_amount.toLocaleString()}
                                            </td>
                                        </tr>
                                    ))}
                            </tbody>
                        </table>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
