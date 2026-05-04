'use client';

import { useState, useTransition, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import type { Tenant, TenantStats, DeviceEntry, NotificationEntry } from '@/lib/types';
import {
    DSTabs,
    DSCard,
    DSCardHeader,
    DSCardContent,
    DSStatusBadge,
    DSPlanBadge,
    MonoChip,
    Btn,
    DSDialog,
    Th,
    DetailRow,
    DSRenewalBadge,
} from '@/components/ui/primitives';
import { HealthCheck } from '@/components/health-check';
import { deleteTenantAction, toggleEnabledAction, updateStatusAction } from '@/lib/actions';
import {
    LayoutGrid,
    CreditCard,
    Smartphone,
    Bell,
    ShieldAlert,
    CheckCircle2,
    XCircle,
    Info,
    PauseCircle,
    Trash2,
    ExternalLink,
    Hash,
} from 'lucide-react';

interface Props {
    tenant: Tenant;
    stats: TenantStats | null;
}

const TAB_ITEMS = [
    { value: 'overview',      label: 'Overview',      icon: <LayoutGrid size={14} /> },
    { value: 'billing',       label: 'Billing',       icon: <CreditCard size={14} /> },
    { value: 'devices',       label: 'Devices',       icon: <Smartphone size={14} /> },
    { value: 'notifications', label: 'Notifications', icon: <Bell size={14} /> },
    { value: 'danger',        label: 'Danger Zone',   icon: <ShieldAlert size={14} /> },
];

export function ClientDetailTabs({ tenant, stats }: Props) {
    const router = useRouter();
    const [tab, setTab] = useState('overview');
    const [isPending, startTransition] = useTransition();
    const [statusMsg, setStatusMsg] = useState('');
    const [confirmDelete, setConfirmDelete] = useState(false);
    const [confirmDisable, setConfirmDisable] = useState(false);

    function doAction(fn: () => Promise<void>) {
        startTransition(async () => {
            try {
                await fn();
                setStatusMsg('');
                router.refresh();
            } catch (err: unknown) {
                setStatusMsg(err instanceof Error ? err.message : 'Action failed');
            }
        });
    }

    const fmtDate = (d: string) =>
        new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

    return (
        <>
            <DSTabs value={tab} onChange={setTab} items={TAB_ITEMS} />

            <div style={{ marginTop: 16 }}>
                {/* ── Overview ─────────────────────────────────────────────────── */}
                {tab === 'overview' && (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
                        {/* Connection */}
                        <DSCard>
                            <DSCardHeader
                                title="Connection"
                                subtitle="Odoo XML-RPC endpoint"
                                action={<HealthCheck slug={tenant.slug} manual />}
                            />
                            <DSCardContent>
                                <DetailRow label="URL" value={
                                    <a href={tenant.odoo_url} target="_blank" rel="noopener noreferrer"
                                        style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 13, color: '#3B82F6' }}>
                                        {tenant.odoo_url.replace(/^https?:\/\//, '').slice(0, 40)}
                                        <ExternalLink size={11} />
                                    </a>
                                } />
                                <DetailRow label="Database" value={<MonoChip size={12}>{tenant.odoo_db}</MonoChip>} />
                                <DetailRow label="Username" value={<span style={{ fontSize: 13, color: '#475569' }}>{tenant.odoo_username ?? '—'}</span>} />
                                <DetailRow label="HR Email"  value={<span style={{ fontSize: 13, color: '#475569' }}>{tenant.hr_email}</span>} last />
                            </DSCardContent>
                        </DSCard>

                        {/* Contact */}
                        <DSCard>
                            <DSCardHeader title="Contact" />
                            <DSCardContent>
                                <DetailRow label="Name" value={<span style={{ fontSize: 13, fontWeight: 500, color: '#0F172A' }}>{tenant.contact_name}</span>} />
                                <DetailRow label="Email" value={
                                    <a href={`mailto:${tenant.contact_email}`} style={{ fontSize: 13, color: '#3B82F6' }}>
                                        {tenant.contact_email}
                                    </a>
                                } />
                                <DetailRow label="Phone" value={<span style={{ fontSize: 13, color: '#475569' }}>{tenant.contact_phone ?? '—'}</span>} last />
                            </DSCardContent>
                        </DSCard>

                        {/* Subscription */}
                        <DSCard>
                            <DSCardHeader title="Subscription" />
                            <DSCardContent>
                                <DetailRow label="Plan"    value={<DSPlanBadge plan={tenant.subscription_plan} />} />
                                <DetailRow label="Status"  value={<DSStatusBadge status={tenant.subscription_status} />} />
                                <DetailRow label="Amount"  value={<span style={{ fontSize: 13, fontWeight: 500, color: '#0F172A' }}>${tenant.monthly_amount.toLocaleString()}/mo</span>} />
                                <DetailRow label="Started" value={<span style={{ fontSize: 13, color: '#475569' }}>{fmtDate(tenant.subscription_start)}</span>} />
                                <DetailRow label="Renewal" value={<DSRenewalBadge date={tenant.subscription_renewal} />} last />
                            </DSCardContent>
                        </DSCard>

                        {/* Activity */}
                        <DSCard>
                            <DSCardHeader title="Activity" />
                            <DSCardContent>
                                <DetailRow label="Active devices"       value={<span style={{ fontSize: 13, color: '#0F172A' }}>{stats?.active_devices ?? '—'}</span>} />
                                <DetailRow label="Total notifications"  value={<span style={{ fontSize: 13, color: '#0F172A' }}>{stats?.notifications_total ?? '—'}</span>} />
                                <DetailRow label="Unread"               value={<span style={{ fontSize: 13, color: '#0F172A' }}>{stats?.notifications_unread ?? '—'}</span>} />
                                <DetailRow label="Last sync"            value={<span style={{ fontSize: 13, color: '#475569' }}>{stats?.last_sync ? new Date(stats.last_sync).toLocaleString() : 'Never'}</span>} />
                                <DetailRow label="Created"              value={<span style={{ fontSize: 13, color: '#475569' }}>{fmtDate(tenant.created_at)}</span>} last />
                            </DSCardContent>
                        </DSCard>

                        {tenant.notes && (
                            <DSCard style={{ gridColumn: 'span 2' }}>
                                <DSCardHeader title="Internal Notes" />
                                <DSCardContent>
                                    <div style={{ fontSize: 13, color: '#475569', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                                        {tenant.notes}
                                    </div>
                                </DSCardContent>
                            </DSCard>
                        )}
                    </div>
                )}

                {/* ── Billing ──────────────────────────────────────────────────── */}
                {tab === 'billing' && (
                    <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 16 }}>
                        <DSCard>
                            <DSCardHeader title="Subscription" action={<DSStatusBadge status={tenant.subscription_status} />} />
                            <DSCardContent>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12, marginBottom: 16 }}>
                                    {[
                                        { label: 'Monthly amount', value: `$${tenant.monthly_amount.toLocaleString()}` },
                                        { label: 'Plan', value: tenant.subscription_plan },
                                        { label: 'Started', value: fmtDate(tenant.subscription_start) },
                                        { label: 'Next renewal', value: fmtDate(tenant.subscription_renewal) },
                                    ].map(({ label, value }) => (
                                        <div key={label} style={{ background: '#F8FAFC', borderRadius: 8, padding: 12 }}>
                                            <div style={{ fontSize: 11, fontWeight: 500, color: '#64748B', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>{label}</div>
                                            <div style={{ fontSize: 16, fontWeight: 600, color: '#0F172A', textTransform: 'capitalize' }}>{value}</div>
                                        </div>
                                    ))}
                                </div>
                                <div style={{ borderTop: '1px solid #F1F5F9', paddingTop: 14 }}>
                                    <div style={{ fontSize: 12, fontWeight: 600, color: '#64748B', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 8 }}>
                                        Quick status change
                                    </div>
                                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                                        {(['active', 'trial', 'overdue', 'suspended', 'cancelled'] as const).map((s) => {
                                            const isActive = tenant.subscription_status === s;
                                            return (
                                                <button
                                                    key={s}
                                                    disabled={isPending || isActive}
                                                    onClick={() => !isActive && doAction(() => updateStatusAction(tenant.slug, s))}
                                                    style={{
                                                        padding: '6px 12px', borderRadius: 6,
                                                        fontSize: 12, fontWeight: 500, textTransform: 'capitalize',
                                                        background: isActive ? '#0F172A' : '#fff',
                                                        color: isActive ? '#fff' : '#475569',
                                                        border: `1px solid ${isActive ? '#0F172A' : '#E2E8F0'}`,
                                                        cursor: isActive ? 'default' : 'pointer',
                                                        opacity: isPending && !isActive ? 0.5 : 1,
                                                        fontFamily: 'inherit',
                                                    }}
                                                >
                                                    {s}
                                                </button>
                                            );
                                        })}
                                    </div>
                                    {statusMsg && <div style={{ fontSize: 12, color: '#DC2626', marginTop: 8 }}>{statusMsg}</div>}
                                </div>
                            </DSCardContent>
                        </DSCard>

                        {/* Placeholder invoices card */}
                        <DSCard>
                            <DSCardHeader title="Recent Invoices" />
                            <DSCardContent>
                                {[0, 1, 2, 3].map((i) => {
                                    const d = new Date(tenant.subscription_start);
                                    d.setMonth(d.getMonth() + i);
                                    return (
                                        <div key={i} style={{
                                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                            padding: '10px 0',
                                            borderBottom: i === 3 ? 'none' : '1px solid #F1F5F9',
                                        }}>
                                            <div>
                                                <div style={{ fontSize: 13, fontWeight: 500, color: '#0F172A' }}>
                                                    INV-{String(2024010 + i).padStart(7, '0')}
                                                </div>
                                                <div style={{ fontSize: 12, color: '#94A3B8' }}>{fmtDate(d.toISOString())}</div>
                                            </div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                                <span style={{ fontSize: 13, color: '#0F172A', fontVariantNumeric: 'tabular-nums' }}>
                                                    ${tenant.monthly_amount.toLocaleString()}
                                                </span>
                                                <span style={{ fontSize: 11, fontWeight: 500, padding: '2px 7px', background: '#D1FAE5', color: '#065F46', borderRadius: 999 }}>
                                                    PAID
                                                </span>
                                            </div>
                                        </div>
                                    );
                                })}
                            </DSCardContent>
                        </DSCard>
                    </div>
                )}

                {/* ── Devices ──────────────────────────────────────────────────── */}
                {tab === 'devices' && (
                    <DevicesTab slug={tenant.slug} statCount={stats?.active_devices ?? 0} />
                )}

                {/* ── Notifications ────────────────────────────────────────────── */}
                {tab === 'notifications' && (
                    <NotificationsTab slug={tenant.slug} />
                )}

                {/* ── Danger Zone ──────────────────────────────────────────────── */}
                {tab === 'danger' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                        {/* Disable/enable card */}
                        <DSCard style={{ borderColor: '#FDE68A', background: '#FFFBEB' }}>
                            <div style={{ padding: 20, display: 'flex', alignItems: 'flex-start', gap: 14 }}>
                                <div style={{ width: 36, height: 36, borderRadius: 8, background: '#FEF3C7', color: '#B45309', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                    <PauseCircle size={18} />
                                </div>
                                <div style={{ flex: 1 }}>
                                    <div style={{ fontSize: 14, fontWeight: 600, color: '#78350F' }}>
                                        {tenant.enabled ? 'Disable tenant' : 'Re-enable tenant'}
                                    </div>
                                    <div style={{ fontSize: 13, color: '#92400E', marginTop: 2, lineHeight: 1.5 }}>
                                        {tenant.enabled
                                            ? 'Pauses mobile sync and push notifications. Billing continues unchanged. Data is retained.'
                                            : 'Resume mobile sync and push notifications for this tenant.'}
                                    </div>
                                </div>
                                <Btn variant="outline" onClick={() => setConfirmDisable(true)}>
                                    {tenant.enabled ? 'Disable' : 'Re-enable'}
                                </Btn>
                            </div>
                        </DSCard>

                        {/* Delete card */}
                        <DSCard style={{ borderColor: '#FECACA', background: '#FEF7F7' }}>
                            <div style={{ padding: 20, display: 'flex', alignItems: 'flex-start', gap: 14 }}>
                                <div style={{ width: 36, height: 36, borderRadius: 8, background: '#FEE2E2', color: '#DC2626', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                    <Trash2 size={18} />
                                </div>
                                <div style={{ flex: 1 }}>
                                    <div style={{ fontSize: 14, fontWeight: 600, color: '#7F1D1D' }}>Delete tenant</div>
                                    <div style={{ fontSize: 13, color: '#991B1B', marginTop: 2, lineHeight: 1.5 }}>
                                        Permanently remove all tenant data — devices, notifications, billing history. This cannot be undone.
                                    </div>
                                </div>
                                <Btn variant="danger" leftIcon={<Trash2 size={14} />} onClick={() => setConfirmDelete(true)}>
                                    Delete
                                </Btn>
                            </div>
                        </DSCard>
                    </div>
                )}
            </div>

            {/* Disable/enable dialog */}
            <DSDialog
                open={confirmDisable}
                onClose={() => setConfirmDisable(false)}
                title={tenant.enabled ? 'Disable this tenant?' : 'Re-enable this tenant?'}
                description={
                    tenant.enabled
                        ? 'Mobile sync and push notifications will stop immediately. Billing remains unchanged.'
                        : 'Mobile sync resumes for all registered devices.'
                }
                footer={
                    <>
                        <Btn variant="secondary" onClick={() => setConfirmDisable(false)}>Cancel</Btn>
                        <Btn
                            disabled={isPending}
                            onClick={() => {
                                doAction(() => toggleEnabledAction(tenant.slug, !tenant.enabled));
                                setConfirmDisable(false);
                            }}
                        >
                            {tenant.enabled ? 'Disable' : 'Re-enable'}
                        </Btn>
                    </>
                }
            />

            {/* Delete dialog */}
            <DSDialog
                open={confirmDelete}
                onClose={() => setConfirmDelete(false)}
                title={`Delete ${tenant.name}?`}
                description={`This will permanently remove ${tenant.slug} and all associated data. Cannot be undone.`}
                danger={`${stats?.active_devices ?? 0} device(s) · ${stats?.notifications_total ?? 0} notification(s) will be erased.`}
                footer={
                    <>
                        <Btn variant="secondary" onClick={() => setConfirmDelete(false)}>Cancel</Btn>
                        <Btn
                            variant="danger"
                            disabled={isPending}
                            onClick={() => {
                                doAction(() => deleteTenantAction(tenant.slug));
                                setConfirmDelete(false);
                            }}
                        >
                            {isPending ? 'Deleting…' : 'Delete permanently'}
                        </Btn>
                    </>
                }
            />
        </>
    );
}

// ─── Devices tab ──────────────────────────────────────────────────────────────

function DevicesTab({ slug, statCount }: { slug: string; statCount: number }) {
    const [devices, setDevices] = useState<DeviceEntry[] | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        fetch(`/api/admin/devices/${slug}`)
            .then((r) => r.json())
            .then(setDevices)
            .catch(() => setError('Failed to load devices'))
            .finally(() => setLoading(false));
    }, [slug]);

    const fmtTime = (s: string) =>
        new Date(s).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' });

    return (
        <DSCard>
            <DSCardHeader
                title="Registered Devices"
                subtitle={`${statCount} push token${statCount !== 1 ? 's' : ''}`}
            />
            {loading ? (
                <div style={{ padding: '48px 20px', textAlign: 'center', fontSize: 13, color: '#94A3B8' }}>Loading…</div>
            ) : error ? (
                <div style={{ padding: '48px 20px', textAlign: 'center', fontSize: 13, color: '#DC2626' }}>{error}</div>
            ) : !devices || devices.length === 0 ? (
                <div style={{ padding: '64px 20px', textAlign: 'center' }}>
                    <div style={{ display: 'inline-flex', width: 48, height: 48, borderRadius: 12, background: '#F1F5F9', color: '#94A3B8', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
                        <Smartphone size={22} />
                    </div>
                    <div style={{ fontSize: 15, fontWeight: 600, color: '#0F172A' }}>No devices registered</div>
                    <div style={{ fontSize: 13, color: '#64748B', marginTop: 4 }}>
                        Devices appear here when employees enable push notifications.
                    </div>
                </div>
            ) : (
                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
                        <thead>
                            <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
                                <Th label="Employee ID" />
                                <Th label="Token Preview" />
                                <Th label="Registered" />
                            </tr>
                        </thead>
                        <tbody>
                            {devices.map((d) => (
                                <tr key={d.employeeId} className="row-hover" style={{ borderTop: '1px solid #F1F5F9' }}>
                                    <td style={{ padding: '12px 16px' }}>
                                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 500, color: '#0F172A' }}>
                                            <Hash size={12} color="#94A3B8" />{d.employeeId}
                                        </span>
                                    </td>
                                    <td style={{ padding: '12px 16px' }}>
                                        <code className="mono" style={{ fontSize: 12, color: '#475569', background: '#F1F5F9', padding: '2px 6px', borderRadius: 4 }}>
                                            {d.token_preview}
                                        </code>
                                    </td>
                                    <td style={{ padding: '12px 16px', fontSize: 13, color: '#64748B' }}>{fmtTime(d.registered_at)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </DSCard>
    );
}

// ─── Notifications tab ────────────────────────────────────────────────────────

const TYPE_META: Record<string, { icon: React.ReactNode; label: string; bg: string; color: string }> = {
    request_approved: { icon: <CheckCircle2 size={13} />, label: 'Approved', bg: '#D1FAE5', color: '#059669' },
    request_rejected: { icon: <XCircle size={13} />,     label: 'Rejected', bg: '#FEE2E2', color: '#DC2626' },
    system:           { icon: <Info size={13} />,         label: 'System',   bg: '#DBEAFE', color: '#2563EB' },
};

const LIMIT = 30;

function NotificationsTab({ slug }: { slug: string }) {
    const [items, setItems] = useState<NotificationEntry[]>([]);
    const [total, setTotal] = useState(0);
    const [offset, setOffset] = useState(0);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const load = useCallback(
        (off: number) => {
            setLoading(true);
            fetch(`/api/admin/notifications/${slug}?limit=${LIMIT}&offset=${off}`)
                .then((r) => r.json())
                .then((data) => {
                    setTotal(data.total ?? 0);
                    setItems((prev) => (off === 0 ? data.items ?? [] : [...prev, ...(data.items ?? [])]));
                    setOffset(off + LIMIT);
                })
                .catch(() => setError('Failed to load notifications'))
                .finally(() => setLoading(false));
        },
        [slug]
    );

    useEffect(() => { load(0); }, [load]);

    const fmtTime = (s: string) => {
        const ms = Date.now() - new Date(s).getTime();
        const min = Math.round(ms / 60000);
        if (min < 60) return `${min}m ago`;
        const h = Math.round(min / 60);
        if (h < 24) return `${h}h ago`;
        return `${Math.round(h / 24)}d ago`;
    };

    return (
        <DSCard>
            <DSCardHeader title="Notification History" subtitle={`${total} total`} />
            {loading && items.length === 0 ? (
                <div style={{ padding: '48px 20px', textAlign: 'center', fontSize: 13, color: '#94A3B8' }}>Loading…</div>
            ) : error ? (
                <div style={{ padding: '48px 20px', textAlign: 'center', fontSize: 13, color: '#DC2626' }}>{error}</div>
            ) : items.length === 0 ? (
                <div style={{ padding: '64px 20px', textAlign: 'center' }}>
                    <div style={{ display: 'inline-flex', width: 48, height: 48, borderRadius: 12, background: '#F1F5F9', color: '#94A3B8', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
                        <Bell size={22} />
                    </div>
                    <div style={{ fontSize: 15, fontWeight: 600, color: '#0F172A' }}>No notifications sent yet</div>
                </div>
            ) : (
                <>
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
                            <thead>
                                <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
                                    <Th label="Type" />
                                    <Th label="Message" />
                                    <Th label="Employee" />
                                    <Th label="" />
                                    <Th label="When" align="right" />
                                </tr>
                            </thead>
                            <tbody>
                                {items.map((n) => {
                                    const m = TYPE_META[n.type] ?? TYPE_META.system;
                                    return (
                                        <tr key={n.id} className="row-hover" style={{ borderTop: '1px solid #F1F5F9' }}>
                                            <td style={{ padding: '12px 16px' }}>
                                                <span style={{
                                                    display: 'inline-flex', alignItems: 'center', gap: 5,
                                                    padding: '3px 8px', borderRadius: 999,
                                                    background: m.bg, color: m.color,
                                                    fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.4,
                                                }}>
                                                    {m.icon}{m.label}
                                                </span>
                                            </td>
                                            <td style={{ padding: '12px 16px', maxWidth: 320 }}>
                                                <div style={{ fontSize: 13, fontWeight: 500, color: '#0F172A' }}>{n.title}</div>
                                                <div style={{ fontSize: 12, color: '#64748B', marginTop: 1 }}>{n.message}</div>
                                            </td>
                                            <td style={{ padding: '12px 16px' }}>
                                                <code className="mono" style={{ fontSize: 12, color: '#475569' }}>#{n.employeeId}</code>
                                            </td>
                                            <td style={{ padding: '12px 16px' }}>
                                                <span style={{
                                                    display: 'inline-block', width: 8, height: 8, borderRadius: 999,
                                                    background: n.read ? '#CBD5E1' : '#3B82F6',
                                                }} title={n.read ? 'Read' : 'Unread'} />
                                            </td>
                                            <td style={{ padding: '12px 16px', textAlign: 'right', fontSize: 12, color: '#94A3B8' }}>
                                                {fmtTime(n.timestamp)}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                    {items.length < total && (
                        <div style={{ padding: '12px 16px', borderTop: '1px solid #F1F5F9', textAlign: 'center' }}>
                            <button
                                onClick={() => load(offset)}
                                disabled={loading}
                                style={{
                                    background: 'none', border: 'none', cursor: loading ? 'not-allowed' : 'pointer',
                                    fontSize: 13, color: '#475569', opacity: loading ? 0.5 : 1, fontFamily: 'inherit',
                                }}
                            >
                                {loading ? 'Loading…' : `Load more (${total - items.length} remaining)`}
                            </button>
                        </div>
                    )}
                </>
            )}
        </DSCard>
    );
}
