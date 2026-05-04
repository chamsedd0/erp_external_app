import Link from 'next/link';
import { api } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { RenewalBadge } from '@/components/renewal-badge';
import {
    Building2,
    CheckCircle2,
    AlertCircle,
    DollarSign,
    PauseCircle,
    Smartphone,
    Plus,
    CreditCard,
} from 'lucide-react';

export default async function DashboardPage() {
    const stats = await api.getPlatformStats().catch(() => null);

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
                    <Plus size={15} />
                    Add New Client
                </Link>
            </div>

            {/* Row 1 — primary stats */}
            <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 mb-4">
                <StatCard
                    label="Total Clients"
                    value={stats?.total ?? '—'}
                    icon={<Building2 size={18} className="text-slate-600" />}
                    iconBg="bg-slate-100"
                />
                <StatCard
                    label="Active"
                    value={stats?.active ?? '—'}
                    icon={<CheckCircle2 size={18} className="text-emerald-600" />}
                    iconBg="bg-emerald-50"
                    valueColor="text-emerald-600"
                />
                <StatCard
                    label="Overdue"
                    value={stats?.overdue ?? '—'}
                    icon={<AlertCircle size={18} className="text-red-500" />}
                    iconBg="bg-red-50"
                    valueColor={stats?.overdue ? 'text-red-600' : ''}
                />
                <StatCard
                    label="Monthly Revenue"
                    value={stats ? `$${stats.monthly_revenue.toLocaleString()}` : '—'}
                    icon={<DollarSign size={18} className="text-blue-600" />}
                    iconBg="bg-blue-50"
                    valueColor="text-blue-600"
                />
            </div>

            {/* Row 2 — secondary stats */}
            <div className="grid grid-cols-2 gap-4 mb-8">
                <StatCard
                    label="Suspended"
                    value={stats?.suspended ?? '—'}
                    icon={<PauseCircle size={18} className="text-orange-500" />}
                    iconBg="bg-orange-50"
                    valueColor={stats?.suspended ? 'text-orange-600' : ''}
                />
                <StatCard
                    label="Active Devices"
                    value={stats?.total_push_tokens ?? '—'}
                    icon={<Smartphone size={18} className="text-purple-600" />}
                    iconBg="bg-purple-50"
                    valueColor="text-purple-600"
                />
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
                                No renewals in the next 30 days
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
                                Icon: Plus,
                                title: 'Add New Client',
                                desc: 'Onboard a new tenant company',
                            },
                            {
                                href: '/clients',
                                Icon: Building2,
                                title: 'View All Clients',
                                desc: `${stats?.total ?? 0} tenant${(stats?.total ?? 0) !== 1 ? 's' : ''} configured`,
                            },
                            {
                                href: '/billing',
                                Icon: CreditCard,
                                title: 'Billing Overview',
                                desc: 'Track subscriptions & payments',
                            },
                        ].map(({ href, Icon, title, desc }) => (
                            <Link key={href} href={href}>
                                <div className="flex items-center gap-3 rounded-lg border border-slate-200 p-3 hover:bg-slate-50 transition-colors">
                                    <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100">
                                        <Icon size={15} className="text-slate-600" />
                                    </span>
                                    <div>
                                        <p className="text-sm font-medium text-slate-900">{title}</p>
                                        <p className="text-xs text-slate-500">{desc}</p>
                                    </div>
                                </div>
                            </Link>
                        ))}

                        {/* Overdue alert */}
                        {stats && stats.overdue > 0 && (
                            <Link href="/billing">
                                <div className="flex items-center gap-3 rounded-lg border border-red-200 bg-red-50 p-3 hover:bg-red-100 transition-colors">
                                    <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-100">
                                        <AlertCircle size={15} className="text-red-600" />
                                    </span>
                                    <div>
                                        <p className="text-sm font-medium text-red-700">
                                            {stats.overdue} overdue account{stats.overdue > 1 ? 's' : ''}
                                        </p>
                                        <p className="text-xs text-red-600">View billing →</p>
                                    </div>
                                </div>
                            </Link>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}

function StatCard({
    label,
    value,
    icon,
    iconBg,
    valueColor,
}: {
    label: string;
    value: string | number;
    icon: React.ReactNode;
    iconBg: string;
    valueColor?: string;
}) {
    return (
        <Card>
            <CardContent className="pt-5 pb-5 flex items-center gap-4">
                <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${iconBg}`}>
                    {icon}
                </span>
                <div>
                    <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">{label}</p>
                    <p className={`text-2xl font-bold mt-0.5 ${valueColor || 'text-slate-900'}`}>{value}</p>
                </div>
            </CardContent>
        </Card>
    );
}
