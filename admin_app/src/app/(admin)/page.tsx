import Link from 'next/link';
import { api } from '@/lib/api';
import { RenewalBadge } from '@/components/renewal-badge';
import {
    DSCard,
    DSCardHeader,
    DSCardContent,
    DSStatCard,
} from '@/components/ui/primitives';
import {
    Building2,
    CheckCircle2,
    AlertCircle,
    DollarSign,
    PauseCircle,
    Smartphone,
    Plus,
    CreditCard,
    ChevronRight,
    RefreshCw,
} from 'lucide-react';

export default async function DashboardPage() {
    const stats = await api.getPlatformStats().catch(() => null);
    const upcoming = (stats?.upcoming_renewals ?? []).slice(0, 5);

    return (
        <div className="page-fade" style={{ padding: 32, maxWidth: 1280, margin: '0 auto' }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: 24 }}>
                <div>
                    <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700, color: '#0F172A', letterSpacing: -0.4 }}>Dashboard</h1>
                    <div style={{ marginTop: 4, fontSize: 14, color: '#64748B' }}>Platform overview</div>
                </div>
                <Link href="/clients/new" style={{
                    display: 'inline-flex', alignItems: 'center', gap: 6,
                    height: 36, padding: '0 16px',
                    background: '#0F172A', color: '#fff',
                    fontSize: 14, fontWeight: 500,
                    borderRadius: 8, textDecoration: 'none',
                    whiteSpace: 'nowrap',
                }}>
                    <Plus size={15} />
                    Add New Client
                </Link>
            </div>

            {/* Row 1 — 4 primary stats */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 16 }}>
                <DSStatCard
                    label="Total Clients"
                    value={stats?.total ?? '—'}
                    subtitle={stats ? `${stats.trial} on trial` : undefined}
                    icon={<Building2 size={18} />}
                    tint="slate"
                />
                <DSStatCard
                    label="Active"
                    value={stats?.active ?? '—'}
                    subtitle="paying customers"
                    icon={<CheckCircle2 size={18} />}
                    tint="emerald"
                    valueColor="#059669"
                />
                <DSStatCard
                    label="Overdue"
                    value={stats?.overdue ?? '—'}
                    subtitle={stats ? (stats.overdue > 0 ? 'needs attention' : 'all clear') : undefined}
                    icon={<AlertCircle size={18} />}
                    tint="red"
                    valueColor={stats?.overdue ? '#DC2626' : undefined}
                />
                <DSStatCard
                    label="MRR"
                    value={stats ? `$${stats.monthly_revenue.toLocaleString()}` : '—'}
                    icon={<DollarSign size={18} />}
                    tint="blue"
                />
            </div>

            {/* Row 2 — 2 secondary stats */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16, marginBottom: 24 }}>
                <DSStatCard
                    label="Suspended"
                    value={stats?.suspended ?? '—'}
                    subtitle="awaiting payment"
                    icon={<PauseCircle size={18} />}
                    tint="orange"
                />
                <DSStatCard
                    label="Active Devices"
                    value={stats?.total_push_tokens ?? '—'}
                    subtitle="push tokens registered"
                    icon={<Smartphone size={18} />}
                    tint="purple"
                />
            </div>

            {/* Two-column grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 16, marginBottom: 16 }}>
                {/* Upcoming renewals */}
                <DSCard>
                    <DSCardHeader
                        title="Upcoming Renewals"
                        subtitle={upcoming.length > 0 ? `${upcoming.length} of ${stats?.upcoming_renewals?.length ?? 0} accounts` : 'Next 30 days'}
                        action={
                            <Link href="/billing" style={{ fontSize: 13, color: '#3B82F6', fontWeight: 500 }}>
                                View all →
                            </Link>
                        }
                    />
                    <div style={{ borderTop: '1px solid #F1F5F9' }}>
                        {upcoming.length > 0 ? upcoming.map((r, i) => (
                            <Link
                                key={r.slug}
                                href={`/clients/${r.slug}`}
                                className="row-hover"
                                style={{
                                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                    padding: '12px 20px',
                                    borderBottom: i === upcoming.length - 1 ? 'none' : '1px solid #F1F5F9',
                                    textDecoration: 'none',
                                }}
                            >
                                <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                                    <div style={{
                                        width: 32, height: 32, borderRadius: 8,
                                        background: '#F1F5F9', color: '#64748B',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                                    }}>
                                        <Building2 size={15} />
                                    </div>
                                    <div style={{ minWidth: 0 }}>
                                        <div style={{ fontSize: 14, fontWeight: 500, color: '#0F172A' }}>{r.name}</div>
                                    </div>
                                </div>
                                <RenewalBadge date={r.renewal} />
                            </Link>
                        )) : (
                            <div style={{ padding: '24px 20px', textAlign: 'center', fontSize: 14, color: '#94A3B8' }}>
                                No renewals in the next 30 days
                            </div>
                        )}
                    </div>
                </DSCard>

                {/* Quick actions */}
                <DSCard>
                    <DSCardHeader title="Quick Actions" />
                    <DSCardContent>
                        <QuickLink
                            href="/clients/new"
                            icon={<Plus size={16} />}
                            title="Add a new client"
                            desc="Spin up a new tenant + Odoo connection"
                        />
                        <QuickLink
                            href="/billing"
                            icon={<CreditCard size={16} />}
                            title="Review billing"
                            desc="See overdue accounts and upcoming renewals"
                        />
                        <QuickLink
                            href="/clients"
                            icon={<RefreshCw size={16} />}
                            title="All clients"
                            desc={`${stats?.total ?? 0} tenant${(stats?.total ?? 0) !== 1 ? 's' : ''} configured`}
                        />
                    </DSCardContent>
                </DSCard>
            </div>

            {/* Overdue alert */}
            {stats && stats.overdue > 0 && (
                <DSCard style={{ borderColor: '#FECACA', background: '#FEF7F7' }}>
                    <div style={{ padding: 20, display: 'flex', alignItems: 'flex-start', gap: 14 }}>
                        <div style={{
                            width: 36, height: 36, borderRadius: 8,
                            background: '#FEE2E2', color: '#DC2626',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                        }}>
                            <AlertCircle size={18} />
                        </div>
                        <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 14, fontWeight: 600, color: '#7F1D1D' }}>
                                {stats.overdue} {stats.overdue === 1 ? 'account is' : 'accounts are'} overdue
                            </div>
                            <div style={{ fontSize: 13, color: '#991B1B', marginTop: 2 }}>
                                Review in Billing to suspend or follow up.
                            </div>
                        </div>
                        <Link href="/billing" style={{
                            display: 'inline-flex', alignItems: 'center', gap: 6,
                            height: 32, padding: '0 12px',
                            background: '#fff', border: '1px solid #FCA5A5',
                            color: '#991B1B', borderRadius: 8,
                            fontSize: 13, fontWeight: 500, textDecoration: 'none',
                        }}>
                            Open Billing →
                        </Link>
                    </div>
                </DSCard>
            )}
        </div>
    );
}

function QuickLink({
    href,
    icon,
    title,
    desc,
}: {
    href: string;
    icon: React.ReactNode;
    title: string;
    desc: string;
}) {
    return (
        <Link
            href={href}
            className="row-hover"
            style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: 12, borderRadius: 8, textDecoration: 'none',
                marginBottom: 2,
            }}
        >
            <div style={{
                width: 32, height: 32, borderRadius: 8,
                background: '#F1F5F9', color: '#475569',
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}>
                {icon}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 500, color: '#0F172A' }}>{title}</div>
                <div style={{ fontSize: 12, color: '#64748B', marginTop: 1 }}>{desc}</div>
            </div>
            <ChevronRight size={14} color="#94A3B8" />
        </Link>
    );
}
