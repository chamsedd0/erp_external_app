import Link from 'next/link';
import { notFound } from 'next/navigation';
import { api } from '@/lib/api';
import { DSStatusBadge, DSPlanBadge, MonoChip, MiniStat, DSRenewalBadge } from '@/components/ui/primitives';
import { ClientDetailTabs } from './client-detail-tabs';
import { ChevronLeft, Pencil, Smartphone, Bell, CalendarDays } from 'lucide-react';

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

    const fmtDate = (d: string) =>
        new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

    return (
        <div className="page-fade" style={{ padding: 32, maxWidth: 1280, margin: '0 auto' }}>
            {/* Back link */}
            <Link href="/clients" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 13, color: '#64748B', textDecoration: 'none', marginBottom: 16 }}>
                <ChevronLeft size={14} />
                Clients
            </Link>

            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: 8 }}>
                <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                        <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700, color: '#0F172A', letterSpacing: -0.4 }}>
                            {tenant.name}
                        </h1>
                        {!tenant.enabled && (
                            <span style={{
                                fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5,
                                padding: '3px 8px', borderRadius: 999,
                                background: '#F1F5F9', color: '#475569', border: '1px solid #CBD5E1',
                            }}>
                                Disabled
                            </span>
                        )}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 8, flexWrap: 'wrap' }}>
                        <MonoChip>{tenant.slug}</MonoChip>
                        <DSStatusBadge status={tenant.subscription_status} />
                        <DSPlanBadge plan={tenant.subscription_plan} />
                        <span style={{ fontSize: 13, color: '#94A3B8' }}>· created {fmtDate(tenant.created_at)}</span>
                    </div>
                </div>
                <Link
                    href={`/clients/${slug}/edit`}
                    style={{
                        display: 'inline-flex', alignItems: 'center', gap: 6,
                        height: 36, padding: '0 16px',
                        background: '#0F172A', color: '#fff',
                        fontSize: 14, fontWeight: 500,
                        borderRadius: 8, textDecoration: 'none',
                    }}
                >
                    <Pencil size={14} />
                    Edit
                </Link>
            </div>

            {/* Mini stats */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, margin: '20px 0 24px' }}>
                <MiniStat
                    label="Active Devices"
                    value={stats?.active_devices ?? '—'}
                    icon={<Smartphone size={16} color="#94A3B8" />}
                />
                <MiniStat
                    label="Total Notifications"
                    value={(stats?.notifications_total ?? 0).toLocaleString()}
                    subtitle={stats ? `${stats.notifications_unread} unread` : undefined}
                    icon={<Bell size={16} color="#94A3B8" />}
                />
                {tenant.subscription_status === 'draft' ? (
                    <MiniStat
                        label="Activation"
                        value="Pending"
                        subtitle="Add Odoo credentials to activate"
                        icon={<CalendarDays size={16} color="#94A3B8" />}
                    />
                ) : (
                    <MiniStat
                        label="Next Renewal"
                        value={fmtDate(tenant.subscription_renewal)}
                        subtitle={`$${tenant.monthly_amount.toLocaleString()}/mo`}
                        icon={<CalendarDays size={16} color="#94A3B8" />}
                    />
                )}
            </div>

            <ClientDetailTabs tenant={tenant} stats={stats} />
        </div>
    );
}
