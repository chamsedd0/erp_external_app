import Link from 'next/link';
import { api } from '@/lib/api';
import { DSStatCard, DSCard, DSCardHeader, DSCardContent, DSStatusBadge, DSPlanBadge, Th } from '@/components/ui/primitives';
import { RenewalBadge } from '@/components/renewal-badge';
import { BillingActions } from './billing-actions';
import { PlansManager } from './plans-manager';
import { DollarSign, AlertTriangle, Clock } from 'lucide-react';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Billing' };

export default async function BillingPage() {
    const [tenants, plans] = await Promise.all([
        api.listTenants().catch(() => [] as Awaited<ReturnType<typeof api.listTenants>>),
        api.listPlans().catch(() => [] as Awaited<ReturnType<typeof api.listPlans>>),
    ]);

    const planMap = new Map(plans.map(p => [p.id, p]));

    const now = new Date();
    const in7  = new Date(now.getTime() + 7  * 86400000);
    const in14 = new Date(now.getTime() + 14 * 86400000);

    const overdue = tenants.filter((t) => t.subscription_status === 'overdue');
    const active  = tenants.filter((t) => ['active', 'overdue'].includes(t.subscription_status));
    const billingAmount = (t: typeof tenants[number]) => t.billing_monthly_amount ?? t.monthly_amount;

    const mrr = tenants
        .filter((t) => ['active', 'overdue'].includes(t.subscription_status))
        .reduce((s, t) => s + billingAmount(t), 0);
    const overdueAmount = overdue.reduce((s, t) => s + billingAmount(t), 0);

    const dueThisWeek = tenants.filter((t) => {
        const d = new Date(t.subscription_renewal);
        return d >= now && d <= in7;
    });

    const upcoming14 = tenants
        .filter((t) => {
            const d = new Date(t.subscription_renewal);
            return d >= now && d <= in14 && t.subscription_status !== 'cancelled';
        })
        .sort((a, b) => a.subscription_renewal.localeCompare(b.subscription_renewal));

    const allSubs = tenants
        .filter((t) => t.subscription_status !== 'cancelled')
        .sort((a, b) => a.subscription_renewal.localeCompare(b.subscription_renewal));

    const fmtDate = (d: string) =>
        new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

    return (
        <div className="page-fade" style={{ padding: 32, maxWidth: 1280, margin: '0 auto' }}>
            {/* Header */}
            <div style={{ marginBottom: 24 }}>
                <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700, color: '#0F172A', letterSpacing: -0.4 }}>Billing</h1>
                <div style={{ marginTop: 4, fontSize: 14, color: '#64748B' }}>
                    Subscription revenue, renewals, and overdue accounts
                </div>
            </div>

            {/* Subscription Plans */}
            <DSCard style={{ marginBottom: 24 }}>
                <DSCardHeader
                    title="Subscription Plans"
                    subtitle="Define plan tiers, employee limits, pricing, and support SLA"
                />
                <DSCardContent>
                    <PlansManager plans={plans} />
                </DSCardContent>
            </DSCard>

            {/* Stats row */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 24 }}>
                <DSStatCard
                    label="Monthly Revenue"
                    value={`$${mrr.toLocaleString()}`}
                    subtitle={`${active.length} active subscription${active.length !== 1 ? 's' : ''}`}
                    icon={<DollarSign size={18} />}
                    tint="blue"
                />
                <DSStatCard
                    label="Overdue Amount"
                    value={overdueAmount > 0 ? `$${overdueAmount.toLocaleString()}` : '$0'}
                    subtitle={`${overdue.length} account${overdue.length !== 1 ? 's' : ''}`}
                    icon={<AlertTriangle size={18} />}
                    tint="red"
                    valueColor={overdueAmount > 0 ? '#DC2626' : undefined}
                />
                <DSStatCard
                    label="Due This Week"
                    value={`$${dueThisWeek.reduce((s, t) => s + billingAmount(t), 0).toLocaleString()}`}
                    subtitle={`${dueThisWeek.length} renewal${dueThisWeek.length !== 1 ? 's' : ''}`}
                    icon={<Clock size={18} />}
                    tint="amber"
                />
            </div>

            {/* Two-column section */}
            <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 1fr', gap: 16, marginBottom: 24 }}>
                {/* Overdue accounts */}
                <DSCard>
                    <DSCardHeader
                        title="Overdue Accounts"
                        subtitle={`${overdue.length} account${overdue.length !== 1 ? 's require' : ' requires'} attention`}
                    />
                    <DSCardContent>
                        {overdue.length === 0 ? (
                            <div style={{ padding: '24px 0', textAlign: 'center', fontSize: 13, color: '#64748B' }}>
                                No overdue accounts. Nicely done.
                            </div>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                                {overdue.map((t) => {
                                    const days = Math.abs(Math.round((now.getTime() - new Date(t.subscription_renewal).getTime()) / 86400000));
                                    return (
                                        <div key={t.slug} style={{
                                            background: '#FEF7F7', border: '1px solid #FECACA',
                                            borderRadius: 10, padding: 14,
                                        }}>
                                            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                                                <div style={{ minWidth: 0, flex: 1 }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                        <Link href={`/clients/${t.slug}`} style={{ fontSize: 14, fontWeight: 600, color: '#0F172A', textDecoration: 'none' }}>
                                                            {t.name}
                                                        </Link>
                                                        <DSPlanBadge plan={t.subscription_plan} />
                                                    </div>
                                                    <div style={{ fontSize: 12, color: '#991B1B', marginTop: 4 }}>
                                                        {t.contact_name} · {t.contact_email}
                                                    </div>
                                                </div>
                                                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                                                    <div style={{ fontSize: 16, fontWeight: 700, color: '#7F1D1D', fontVariantNumeric: 'tabular-nums' }}>
                                                        ${billingAmount(t).toLocaleString()}
                                                    </div>
                                                    <div style={{ fontSize: 11, color: '#B91C1C', fontWeight: 500 }}>{days}d overdue</div>
                                                </div>
                                            </div>
                                            <BillingActions slug={t.slug} />
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </DSCardContent>
                </DSCard>

                {/* Upcoming renewals */}
                <DSCard>
                    <DSCardHeader title="Upcoming Renewals" subtitle="Next 14 days" />
                    {upcoming14.length === 0 ? (
                        <DSCardContent>
                            <div style={{ padding: '24px 0', textAlign: 'center', fontSize: 13, color: '#64748B' }}>
                                No renewals in the next 14 days.
                            </div>
                        </DSCardContent>
                    ) : (
                        <div style={{ paddingBottom: 4 }}>
                            {upcoming14.map((t, i) => {
                                const diff = Math.round((new Date(t.subscription_renewal).getTime() - now.getTime()) / 86400000);
                                const renewal = new Date(t.subscription_renewal);
                                return (
                                    <Link
                                        key={t.slug}
                                        href={`/clients/${t.slug}`}
                                        className="row-hover"
                                        style={{
                                            display: 'grid', gridTemplateColumns: '48px 1fr auto', alignItems: 'center', gap: 12,
                                            padding: '12px 20px', textDecoration: 'none',
                                            borderBottom: i === upcoming14.length - 1 ? 'none' : '1px solid #F1F5F9',
                                        }}
                                    >
                                        <div style={{
                                            width: 44, height: 44, borderRadius: 8,
                                            background: diff <= 3 ? '#FEF3C7' : '#F1F5F9',
                                            color: diff <= 3 ? '#92400E' : '#475569',
                                            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                                            fontWeight: 600, lineHeight: 1,
                                        }}>
                                            <div style={{ fontSize: 16 }}>{renewal.getDate()}</div>
                                            <div style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 2 }}>
                                                {renewal.toLocaleString('en-US', { month: 'short' })}
                                            </div>
                                        </div>
                                        <div style={{ minWidth: 0 }}>
                                            <div style={{ fontSize: 14, fontWeight: 500, color: '#0F172A' }}>{t.name}</div>
                                            <div style={{ fontSize: 12, color: '#94A3B8', marginTop: 2 }}>
                                                in {diff === 0 ? 'today' : `${diff}d`} · {t.subscription_plan}
                                            </div>
                                        </div>
                                        <div style={{ fontSize: 14, fontWeight: 600, color: '#0F172A', fontVariantNumeric: 'tabular-nums' }}>
                                            ${billingAmount(t).toLocaleString()}
                                        </div>
                                    </Link>
                                );
                            })}
                        </div>
                    )}
                </DSCard>
            </div>

            {/* All subscriptions table */}
            <DSCard style={{ overflow: 'hidden', padding: 0 }}>
                <div style={{ padding: '16px 20px', borderBottom: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div>
                        <div style={{ fontSize: 14, fontWeight: 600, color: '#0F172A' }}>All Subscriptions</div>
                        <div style={{ fontSize: 12, color: '#94A3B8', marginTop: 2 }}>Sorted by renewal date ascending</div>
                    </div>
                </div>
                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
                        <thead>
                            <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
                                <Th label="Company" />
                                <Th label="Plan" />
                                <Th label="Status" />
                                <Th label="Registered Users" align="right" />
                                <Th label="Active Devices" align="right" />
                                <Th label="Renewal" />
                                <Th label="Amount" align="right" />
                            </tr>
                        </thead>
                        <tbody>
                            {allSubs.map((t) => (
                                <tr key={t.slug} className="row-hover" style={{ borderTop: '1px solid #F1F5F9' }}>
                                    <td style={{ padding: '12px 16px' }}>
                                        <Link href={`/clients/${t.slug}`} style={{ fontSize: 13, fontWeight: 500, color: '#0F172A', textDecoration: 'none' }}>
                                            {t.name}
                                        </Link>
                                        <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 1 }}>{t.contact_email}</div>
                                    </td>
                                    <td style={{ padding: '12px 16px' }}><DSPlanBadge plan={t.subscription_plan} /></td>
                                    <td style={{ padding: '12px 16px' }}><DSStatusBadge status={t.subscription_status} /></td>
                                    <td style={{ padding: '12px 16px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: '#0F172A' }}>
                                        {t.registered_app_users ?? 0}
                                    </td>
                                    <td style={{ padding: '12px 16px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: '#475569' }}>
                                        {t.active_devices ?? 0}
                                    </td>
                                    <td style={{ padding: '12px 16px' }}><RenewalBadge date={t.subscription_renewal} /></td>
                                    <td style={{ padding: '12px 16px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 500, color: '#0F172A' }}>
                                        {planMap.get(t.subscription_plan)?.pricing_model === 'per_employee' ? (
                                            <div>
                                                <div style={{ fontSize: 14, color: '#0F172A', fontWeight: 700 }}>
                                                    ${billingAmount(t).toLocaleString()}
                                                </div>
                                                <div style={{ fontSize: 12, color: '#3B82F6', fontWeight: 600 }}>
                                                    ${planMap.get(t.subscription_plan)!.price_per_employee}/emp/mo
                                                </div>
                                                {t.billing_source === 'manual_override' && (
                                                    <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 1 }}>
                                                        override: ${billingAmount(t).toLocaleString()}
                                                    </div>
                                                )}
                                            </div>
                                        ) : (
                                            `$${billingAmount(t).toLocaleString()}`
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </DSCard>
        </div>
    );
}
