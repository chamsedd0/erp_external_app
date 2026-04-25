import Link from 'next/link';
import { api } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { RenewalBadge } from '@/components/renewal-badge';
import { StatusBadge } from '@/components/ui/badge';

export default async function DashboardPage() {
    const stats = await api.getPlatformStats().catch(() => null);

    const statCards = [
        { label: 'Total Clients', value: stats?.total ?? '—', color: '' },
        { label: 'Active', value: stats?.active ?? '—', color: 'text-emerald-600' },
        { label: 'Overdue', value: stats?.overdue ?? '—', color: stats?.overdue ? 'text-red-600' : '' },
        { label: 'Monthly Revenue', value: stats ? `$${stats.monthly_revenue.toLocaleString()}` : '—', color: 'text-blue-600' },
    ];

    return (
        <div className="p-8 max-w-6xl mx-auto">
            {/* Header */}
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
                    <p className="text-sm text-slate-500 mt-0.5">Platform overview</p>
                </div>
                <Link
                    href="/clients/new"
                    className="inline-flex items-center gap-1.5 h-9 rounded-lg bg-slate-900 text-white text-sm font-medium px-4 hover:bg-slate-800 transition-colors"
                >
                    + Add New Client
                </Link>
            </div>

            {/* Stat cards */}
            <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 mb-8">
                {statCards.map(({ label, value, color }) => (
                    <Card key={label}>
                        <CardContent className="pt-5 pb-5">
                            <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">{label}</p>
                            <p className={`text-3xl font-bold mt-1 ${color || 'text-slate-900'}`}>{value}</p>
                        </CardContent>
                    </Card>
                ))}
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                {/* Upcoming renewals */}
                <Card>
                    <CardHeader>
                        <CardTitle>Upcoming Renewals</CardTitle>
                        <span className="text-xs text-slate-400">Next 30 days</span>
                    </CardHeader>
                    <CardContent>
                        {stats?.upcoming_renewals?.length ? (
                            <div className="divide-y divide-slate-100">
                                {stats.upcoming_renewals.map((r) => (
                                    <div key={r.slug} className="flex items-center justify-between py-2.5">
                                        <Link
                                            href={`/clients/${r.slug}`}
                                            className="text-sm font-medium text-slate-900 hover:text-slate-600 hover:underline"
                                        >
                                            {r.name}
                                        </Link>
                                        <RenewalBadge date={r.renewal} />
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className="text-sm text-slate-400 py-4 text-center">
                                No renewals in the next 30 days ✓
                            </p>
                        )}
                    </CardContent>
                </Card>

                {/* Quick actions */}
                <Card>
                    <CardHeader>
                        <CardTitle>Quick Actions</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                        {[
                            {
                                href: '/clients/new',
                                icon: '➕',
                                title: 'Add New Client',
                                desc: 'Onboard a new tenant company',
                            },
                            {
                                href: '/clients',
                                icon: '🏢',
                                title: 'View All Clients',
                                desc: `${stats?.total ?? 0} tenants configured`,
                            },
                            {
                                href: '/billing',
                                icon: '💳',
                                title: 'Billing Overview',
                                desc: 'Track subscriptions & payments',
                            },
                        ].map(({ href, icon, title, desc }) => (
                            <Link key={href} href={href}>
                                <div className="flex items-center gap-3 rounded-lg border border-slate-200 p-3 hover:bg-slate-50 transition-colors">
                                    <span className="text-lg">{icon}</span>
                                    <div>
                                        <p className="text-sm font-medium text-slate-900">{title}</p>
                                        <p className="text-xs text-slate-500">{desc}</p>
                                    </div>
                                </div>
                            </Link>
                        ))}

                        {/* Overdue alert */}
                        {stats && stats.overdue > 0 && (
                            <div className="flex items-center gap-3 rounded-lg border border-red-200 bg-red-50 p-3">
                                <span className="text-lg">🔴</span>
                                <div>
                                    <p className="text-sm font-medium text-red-700">
                                        {stats.overdue} overdue account{stats.overdue > 1 ? 's' : ''}
                                    </p>
                                    <Link href="/billing" className="text-xs text-red-600 hover:underline">
                                        View billing →
                                    </Link>
                                </div>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* Push tokens row */}
            {stats && (
                <div className="mt-6">
                    <Card>
                        <CardContent className="pt-5 pb-5 flex items-center gap-8">
                            <div>
                                <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">
                                    Total Active Devices
                                </p>
                                <p className="text-2xl font-bold text-slate-900 mt-1">
                                    {stats.total_push_tokens}
                                </p>
                            </div>
                            <div className="text-xs text-slate-400">
                                Push notification endpoints across all tenants
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}
        </div>
    );
}
