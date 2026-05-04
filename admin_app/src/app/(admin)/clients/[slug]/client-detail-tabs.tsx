'use client';

import { useState, useTransition, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import type { Tenant, TenantStats, DeviceEntry, NotificationEntry } from '@/lib/types';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StatusBadge, PlanBadge, Badge } from '@/components/ui/badge';
import { HealthCheck } from '@/components/health-check';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogTrigger,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
    DialogClose,
} from '@/components/ui/dialog';
import { deleteTenantAction, toggleEnabledAction, updateStatusAction } from '@/lib/actions';
import {
    LayoutGrid,
    CreditCard,
    Smartphone,
    Bell,
    ShieldAlert,
    ExternalLink,
    CheckCircle2,
    XCircle,
    Info,
    AlertTriangle,
    Trash2,
} from 'lucide-react';

interface Props {
    tenant: Tenant;
    stats: TenantStats | null;
}

export function ClientDetailTabs({ tenant, stats }: Props) {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();
    const [statusMsg, setStatusMsg] = useState('');

    function Row({ label, value }: { label: string; value: React.ReactNode }) {
        return (
            <div className="flex items-start py-2.5 border-b border-slate-100 last:border-0 gap-4">
                <span className="w-40 shrink-0 text-sm text-slate-500">{label}</span>
                <span className="text-sm text-slate-900 break-all">{value ?? '—'}</span>
            </div>
        );
    }

    function doAction(fn: () => Promise<void>) {
        startTransition(async () => {
            try {
                await fn();
                setStatusMsg('');
                router.refresh();
            } catch (err: any) {
                setStatusMsg(err.message ?? 'Action failed');
            }
        });
    }

    return (
        <Tabs defaultValue="overview">
            <TabsList>
                <TabsTrigger value="overview">
                    <LayoutGrid size={13} className="mr-1.5" />Overview
                </TabsTrigger>
                <TabsTrigger value="billing">
                    <CreditCard size={13} className="mr-1.5" />Billing
                </TabsTrigger>
                <TabsTrigger value="devices">
                    <Smartphone size={13} className="mr-1.5" />Devices
                </TabsTrigger>
                <TabsTrigger value="notifications">
                    <Bell size={13} className="mr-1.5" />Notifications
                </TabsTrigger>
                <TabsTrigger value="danger">
                    <ShieldAlert size={13} className="mr-1.5" />Danger Zone
                </TabsTrigger>
            </TabsList>

            {/* ── Overview ─────────────────────────────────────────────────────── */}
            <TabsContent value="overview">
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                    <Card>
                        <CardHeader><CardTitle>Connection</CardTitle></CardHeader>
                        <CardContent>
                            <Row label="Odoo URL" value={
                                <a href={tenant.odoo_url} target="_blank" rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1 text-blue-600 hover:underline">
                                    {tenant.odoo_url}
                                    <ExternalLink size={11} />
                                </a>
                            } />
                            <Row label="Database" value={
                                <code className="text-xs bg-slate-100 px-1.5 py-0.5 rounded font-mono">{tenant.odoo_db}</code>
                            } />
                            <Row label="Username" value={tenant.odoo_username ?? '—'} />
                            <Row label="HR Email" value={tenant.hr_email} />
                            <div className="pt-3">
                                <HealthCheck slug={tenant.slug} manual />
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader><CardTitle>Contact</CardTitle></CardHeader>
                        <CardContent>
                            <Row label="Name" value={tenant.contact_name} />
                            <Row label="Email" value={
                                <a href={`mailto:${tenant.contact_email}`} className="text-blue-600 hover:underline">
                                    {tenant.contact_email}
                                </a>
                            } />
                            <Row label="Phone" value={tenant.contact_phone} />
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader><CardTitle>Subscription</CardTitle></CardHeader>
                        <CardContent>
                            <Row label="Plan" value={<PlanBadge plan={tenant.subscription_plan} />} />
                            <Row label="Status" value={<StatusBadge status={tenant.subscription_status} />} />
                            <Row label="Start date" value={tenant.subscription_start} />
                            <Row label="Renewal date" value={tenant.subscription_renewal} />
                            <Row label="Monthly amount" value={`$${tenant.monthly_amount.toLocaleString()}/mo`} />
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader><CardTitle>Activity</CardTitle></CardHeader>
                        <CardContent>
                            <Row label="Active devices" value={stats?.active_devices ?? '—'} />
                            <Row label="Total notifications" value={stats?.notifications_total ?? '—'} />
                            <Row label="Unread" value={stats?.notifications_unread ?? '—'} />
                            <Row label="Last sync" value={stats?.last_sync ? new Date(stats.last_sync).toLocaleString() : 'Never'} />
                            <Row label="Created" value={new Date(tenant.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })} />
                        </CardContent>
                    </Card>

                    {tenant.notes && (
                        <Card className="xl:col-span-2">
                            <CardHeader><CardTitle>Notes</CardTitle></CardHeader>
                            <CardContent>
                                <p className="text-sm text-slate-700 whitespace-pre-wrap">{tenant.notes}</p>
                            </CardContent>
                        </Card>
                    )}
                </div>
            </TabsContent>

            {/* ── Billing ──────────────────────────────────────────────────────── */}
            <TabsContent value="billing">
                <Card>
                    <CardHeader><CardTitle>Subscription Management</CardTitle></CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            <div className="flex items-center justify-between p-4 rounded-lg bg-slate-50 border border-slate-200">
                                <div>
                                    <p className="text-sm font-medium text-slate-900">Current Status</p>
                                    <div className="mt-1"><StatusBadge status={tenant.subscription_status} /></div>
                                </div>
                                <div className="text-right">
                                    <p className="text-2xl font-bold text-slate-900">${tenant.monthly_amount.toLocaleString()}</p>
                                    <p className="text-xs text-slate-500">per month</p>
                                </div>
                            </div>

                            <div className="flex items-center justify-between p-4 rounded-lg border border-slate-200">
                                <p className="text-sm font-medium text-slate-700">Next renewal</p>
                                <span className="font-mono text-sm text-slate-900">{tenant.subscription_renewal}</span>
                            </div>

                            <div>
                                <p className="text-sm font-medium text-slate-700 mb-2">Quick status change</p>
                                <div className="flex flex-wrap gap-2">
                                    {(['active', 'trial', 'overdue', 'suspended', 'cancelled'] as const).map((s) => (
                                        <button
                                            key={s}
                                            disabled={isPending || tenant.subscription_status === s}
                                            onClick={() => doAction(() => updateStatusAction(tenant.slug, s))}
                                            className="h-8 rounded-lg border border-slate-300 bg-white px-3 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed capitalize"
                                        >
                                            {tenant.subscription_status === s ? `✓ ${s}` : `→ ${s}`}
                                        </button>
                                    ))}
                                </div>
                                {statusMsg && <p className="text-xs text-red-600 mt-2">{statusMsg}</p>}
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </TabsContent>

            {/* ── Devices ──────────────────────────────────────────────────────── */}
            <TabsContent value="devices">
                <DevicesTab slug={tenant.slug} statCount={stats?.active_devices ?? 0} />
            </TabsContent>

            {/* ── Notifications ────────────────────────────────────────────────── */}
            <TabsContent value="notifications">
                <NotificationsTab slug={tenant.slug} statTotal={stats?.notifications_total ?? 0} />
            </TabsContent>

            {/* ── Danger Zone ──────────────────────────────────────────────────── */}
            <TabsContent value="danger">
                <div className="space-y-4">
                    <Card className="border-amber-200">
                        <CardHeader>
                            <CardTitle className="text-amber-700">
                                {tenant.enabled ? 'Disable Tenant' : 'Enable Tenant'}
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-sm text-slate-600 mb-4">
                                {tenant.enabled
                                    ? 'Disabling prevents users from logging in. Existing data is preserved.'
                                    : 'Re-enabling allows users to log in again.'}
                            </p>
                            <Dialog>
                                <DialogTrigger asChild>
                                    <Button variant="outline" className="border-amber-300 text-amber-700 hover:bg-amber-50">
                                        <AlertTriangle size={14} />
                                        {tenant.enabled ? 'Disable tenant' : 'Enable tenant'}
                                    </Button>
                                </DialogTrigger>
                                <DialogContent>
                                    <DialogHeader>
                                        <DialogTitle>{tenant.enabled ? 'Disable' : 'Enable'} {tenant.name}?</DialogTitle>
                                        <DialogDescription>
                                            {tenant.enabled
                                                ? 'Users will not be able to log in until re-enabled.'
                                                : 'Users will be able to log in again.'}
                                        </DialogDescription>
                                    </DialogHeader>
                                    <DialogFooter>
                                        <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
                                        <DialogClose asChild>
                                            <Button
                                                variant={tenant.enabled ? 'destructive' : 'default'}
                                                disabled={isPending}
                                                onClick={() => doAction(() => toggleEnabledAction(tenant.slug, !tenant.enabled))}
                                            >
                                                Confirm
                                            </Button>
                                        </DialogClose>
                                    </DialogFooter>
                                </DialogContent>
                            </Dialog>
                        </CardContent>
                    </Card>

                    <Card className="border-red-200">
                        <CardHeader><CardTitle className="text-red-700">Delete Tenant</CardTitle></CardHeader>
                        <CardContent>
                            <p className="text-sm text-slate-600 mb-4">
                                Permanently removes this tenant and all associated Redis keys. This cannot be undone.
                            </p>
                            <Dialog>
                                <DialogTrigger asChild>
                                    <Button variant="destructive">
                                        <Trash2 size={14} />
                                        Delete tenant
                                    </Button>
                                </DialogTrigger>
                                <DialogContent>
                                    <DialogHeader>
                                        <DialogTitle>Delete {tenant.name}?</DialogTitle>
                                        <DialogDescription>
                                            This will permanently remove <strong>{tenant.slug}</strong> and all associated data. Cannot be undone.
                                        </DialogDescription>
                                    </DialogHeader>
                                    <div className="my-3 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
                                        Slug: <strong>{tenant.slug}</strong> · {stats?.active_devices ?? 0} device(s) · {stats?.notifications_total ?? 0} notification(s)
                                    </div>
                                    <DialogFooter>
                                        <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
                                        <Button variant="destructive" disabled={isPending}
                                            onClick={() => doAction(() => deleteTenantAction(tenant.slug))}>
                                            {isPending ? 'Deleting…' : 'Delete permanently'}
                                        </Button>
                                    </DialogFooter>
                                </DialogContent>
                            </Dialog>
                        </CardContent>
                    </Card>
                </div>
            </TabsContent>
        </Tabs>
    );
}

// ─── Devices tab (client component with lazy fetch) ───────────────────────────

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

    return (
        <Card>
            <CardHeader>
                <CardTitle>Registered Devices</CardTitle>
                <span className="text-xs text-slate-400">{statCount} push token{statCount !== 1 ? 's' : ''}</span>
            </CardHeader>
            <CardContent className="p-0">
                {loading ? (
                    <div className="px-5 py-8 text-center text-sm text-slate-400">Loading…</div>
                ) : error ? (
                    <div className="px-5 py-8 text-center text-sm text-red-500">{error}</div>
                ) : !devices || devices.length === 0 ? (
                    <div className="px-5 py-8 text-center">
                        <Smartphone size={28} className="mx-auto text-slate-300 mb-2" />
                        <p className="text-sm text-slate-400">No devices registered yet</p>
                        <p className="text-xs text-slate-400 mt-1">Devices appear here when employees enable push notifications</p>
                    </div>
                ) : (
                    <table className="w-full text-sm">
                        <thead className="border-b border-slate-200 bg-slate-50">
                            <tr>
                                {['Employee ID', 'Token (preview)', 'Registered'].map((h) => (
                                    <th key={h} className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wide">{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {devices.map((d) => (
                                <tr key={d.employeeId} className="hover:bg-slate-50">
                                    <td className="px-4 py-3 font-medium text-slate-900">#{d.employeeId}</td>
                                    <td className="px-4 py-3 font-mono text-xs text-slate-500">{d.token_preview}</td>
                                    <td className="px-4 py-3 text-slate-600 text-xs">
                                        {new Date(d.registered_at).toLocaleString()}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </CardContent>
        </Card>
    );
}

// ─── Notifications tab (client component with lazy fetch + pagination) ─────────

const TYPE_ICONS: Record<string, React.ReactNode> = {
    request_approved: <CheckCircle2 size={13} className="text-emerald-500" />,
    request_rejected: <XCircle size={13} className="text-red-500" />,
    system: <Info size={13} className="text-blue-500" />,
};

function NotificationsTab({ slug, statTotal }: { slug: string; statTotal: number }) {
    const [items, setItems] = useState<NotificationEntry[]>([]);
    const [total, setTotal] = useState(0);
    const [offset, setOffset] = useState(0);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const LIMIT = 30;

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

    return (
        <Card>
            <CardHeader>
                <CardTitle>Notification History</CardTitle>
                <span className="text-xs text-slate-400">{total} total</span>
            </CardHeader>
            <CardContent className="p-0">
                {loading && items.length === 0 ? (
                    <div className="px-5 py-8 text-center text-sm text-slate-400">Loading…</div>
                ) : error ? (
                    <div className="px-5 py-8 text-center text-sm text-red-500">{error}</div>
                ) : items.length === 0 ? (
                    <div className="px-5 py-8 text-center">
                        <Bell size={28} className="mx-auto text-slate-300 mb-2" />
                        <p className="text-sm text-slate-400">No notifications sent yet</p>
                    </div>
                ) : (
                    <>
                        <table className="w-full text-sm">
                            <thead className="border-b border-slate-200 bg-slate-50">
                                <tr>
                                    {['Type', 'Employee', 'Message', 'Status', 'Time'].map((h) => (
                                        <th key={h} className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wide">{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {items.map((n) => (
                                    <tr key={n.id} className="hover:bg-slate-50">
                                        <td className="px-4 py-3">
                                            <span className="inline-flex items-center gap-1.5">
                                                {TYPE_ICONS[n.type] ?? <Info size={13} className="text-slate-400" />}
                                                <span className="text-xs text-slate-600 capitalize">{n.type.replace(/_/g, ' ')}</span>
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-slate-600 text-xs">#{n.employeeId}</td>
                                        <td className="px-4 py-3 text-slate-700 max-w-xs truncate">{n.message}</td>
                                        <td className="px-4 py-3">
                                            <span className={`inline-flex items-center gap-1 text-xs font-medium ${n.read ? 'text-slate-400' : 'text-blue-600'}`}>
                                                <span className={`h-1.5 w-1.5 rounded-full ${n.read ? 'bg-slate-300' : 'bg-blue-500'}`} />
                                                {n.read ? 'Read' : 'Unread'}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-xs text-slate-400 whitespace-nowrap">
                                            {new Date(n.timestamp).toLocaleString()}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        {items.length < total && (
                            <div className="px-5 py-3 border-t border-slate-100 text-center">
                                <button
                                    onClick={() => load(offset)}
                                    disabled={loading}
                                    className="text-xs text-slate-500 hover:text-slate-700 disabled:opacity-50"
                                >
                                    {loading ? 'Loading…' : `Load more (${total - items.length} remaining)`}
                                </button>
                            </div>
                        )}
                    </>
                )}
            </CardContent>
        </Card>
    );
}
