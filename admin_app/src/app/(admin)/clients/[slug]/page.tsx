import Link from 'next/link';
import { notFound } from 'next/navigation';
import { api } from '@/lib/api';
import { StatusBadge, PlanBadge } from '@/components/ui/badge';
import { RenewalBadge } from '@/components/renewal-badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ClientDetailTabs } from './client-detail-tabs';

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
    const { slug } = await params;
    return { title: `${slug} — Shadow Portal Admin` };
}

export default async function ClientDetailPage({
    params,
}: {
    params: Promise<{ slug: string }>;
}) {
    const { slug } = await params;

    const [tenant, stats] = await Promise.all([
        api.getTenant(slug).catch(() => null),
        api.getTenantStats(slug).catch(() => null),
    ]);

    if (!tenant) notFound();

    return (
        <div className="p-8 max-w-6xl mx-auto">
            {/* Header */}
            <div className="mb-6">
                <Link href="/clients" className="text-sm text-slate-500 hover:text-slate-700">
                    ← Back to clients
                </Link>
                <div className="flex items-start justify-between mt-3">
                    <div>
                        <div className="flex items-center gap-2.5">
                            <h1 className="text-2xl font-bold text-slate-900">{tenant.name}</h1>
                            {!tenant.enabled && (
                                <span className="text-xs bg-slate-100 text-slate-500 rounded px-2 py-0.5 font-medium">
                                    Disabled
                                </span>
                            )}
                        </div>
                        <div className="flex items-center gap-2 mt-1.5">
                            <span className="text-xs text-slate-400 font-mono bg-slate-100 rounded px-1.5 py-0.5">
                                {tenant.slug}
                            </span>
                            <StatusBadge status={tenant.subscription_status} />
                            <PlanBadge plan={tenant.subscription_plan} />
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <Link
                            href={`/clients/${slug}/edit`}
                            className="inline-flex items-center h-9 rounded-lg border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
                        >
                            Edit
                        </Link>
                    </div>
                </div>
            </div>

            {/* Stats bar */}
            <div className="grid grid-cols-3 gap-4 mb-6">
                <Card>
                    <CardContent className="pt-4 pb-4">
                        <p className="text-xs text-slate-500">Active Devices</p>
                        <p className="text-2xl font-bold text-slate-900 mt-0.5">
                            {stats?.active_devices ?? '—'}
                        </p>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="pt-4 pb-4">
                        <p className="text-xs text-slate-500">Total Notifications</p>
                        <p className="text-2xl font-bold text-slate-900 mt-0.5">
                            {stats?.notifications_total ?? '—'}
                        </p>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="pt-4 pb-4">
                        <p className="text-xs text-slate-500">Next Renewal</p>
                        <div className="mt-0.5">
                            <RenewalBadge date={tenant.subscription_renewal} />
                        </div>
                    </CardContent>
                </Card>
            </div>

            <ClientDetailTabs tenant={tenant} stats={stats} />
        </div>
    );
}
