'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type { Tenant, TenantStats } from '@/lib/types';
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
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="billing">Billing</TabsTrigger>
                <TabsTrigger value="devices">Devices</TabsTrigger>
                <TabsTrigger value="danger">Danger Zone</TabsTrigger>
            </TabsList>

            {/* ── Overview ─────────────────────────────────────────────────────── */}
            <TabsContent value="overview">
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                    <Card>
                        <CardHeader>
                            <CardTitle>Connection</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <Row label="Odoo URL" value={<a href={tenant.odoo_url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">{tenant.odoo_url}</a>} />
                            <Row label="Database" value={<code className="text-xs bg-slate-100 px-1.5 py-0.5 rounded">{tenant.odoo_db}</code>} />
                            <Row label="Username" value={tenant.odoo_username ?? '—'} />
                            <Row label="HR Email" value={tenant.hr_email} />
                            <div className="pt-3">
                                <HealthCheck slug={tenant.slug} manual />
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>Contact</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <Row label="Name" value={tenant.contact_name} />
                            <Row label="Email" value={<a href={`mailto:${tenant.contact_email}`} className="text-blue-600 hover:underline">{tenant.contact_email}</a>} />
                            <Row label="Phone" value={tenant.contact_phone} />
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>Subscription</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <Row label="Plan" value={<PlanBadge plan={tenant.subscription_plan} />} />
                            <Row label="Status" value={<StatusBadge status={tenant.subscription_status} />} />
                            <Row label="Start date" value={tenant.subscription_start} />
                            <Row label="Renewal date" value={tenant.subscription_renewal} />
                            <Row label="Monthly amount" value={`$${tenant.monthly_amount.toLocaleString()}/mo`} />
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>Activity</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <Row label="Active devices" value={stats?.active_devices ?? '—'} />
                            <Row label="Total notifications" value={stats?.notifications_total ?? '—'} />
                            <Row label="Unread notifications" value={stats?.notifications_unread ?? '—'} />
                            <Row label="Last sync" value={stats?.last_sync ? new Date(stats.last_sync).toLocaleString() : 'Never'} />
                            <Row label="Created" value={new Date(tenant.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })} />
                        </CardContent>
                    </Card>

                    {tenant.notes && (
                        <Card className="xl:col-span-2">
                            <CardHeader>
                                <CardTitle>Notes</CardTitle>
                            </CardHeader>
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
                    <CardHeader>
                        <CardTitle>Subscription Management</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            <div className="flex items-center justify-between p-4 rounded-lg bg-slate-50 border border-slate-200">
                                <div>
                                    <p className="text-sm font-medium text-slate-900">Current Status</p>
                                    <div className="mt-1">
                                        <StatusBadge status={tenant.subscription_status} />
                                    </div>
                                </div>
                                <div className="text-right">
                                    <p className="text-2xl font-bold text-slate-900">
                                        ${tenant.monthly_amount.toLocaleString()}
                                    </p>
                                    <p className="text-xs text-slate-500">per month</p>
                                </div>
                            </div>

                            <div className="flex items-center justify-between p-4 rounded-lg border border-slate-200">
                                <div>
                                    <p className="text-sm font-medium text-slate-700">Next renewal</p>
                                    <div className="mt-1">
                                        <span className="font-mono text-sm text-slate-900">{tenant.subscription_renewal}</span>
                                    </div>
                                </div>
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
                <Card>
                    <CardHeader>
                        <CardTitle>Active Devices</CardTitle>
                        <span className="text-xs text-slate-400">
                            {stats?.active_devices ?? 0} push token{(stats?.active_devices ?? 0) !== 1 ? 's' : ''} registered
                        </span>
                    </CardHeader>
                    <CardContent>
                        {(stats?.active_devices ?? 0) === 0 ? (
                            <p className="text-sm text-slate-400 py-4 text-center">
                                No devices registered yet
                            </p>
                        ) : (
                            <p className="text-sm text-slate-500 py-2">
                                {stats!.active_devices} device{stats!.active_devices !== 1 ? 's' : ''} have active push notification tokens.
                                Detailed device listing is available via the backend API.
                            </p>
                        )}
                    </CardContent>
                </Card>
            </TabsContent>

            {/* ── Danger Zone ──────────────────────────────────────────────────── */}
            <TabsContent value="danger">
                <div className="space-y-4">
                    {/* Toggle enabled */}
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
                                        {tenant.enabled ? '⚠️ Disable tenant' : '✅ Enable tenant'}
                                    </Button>
                                </DialogTrigger>
                                <DialogContent>
                                    <DialogHeader>
                                        <DialogTitle>
                                            {tenant.enabled ? 'Disable' : 'Enable'} {tenant.name}?
                                        </DialogTitle>
                                        <DialogDescription>
                                            {tenant.enabled
                                                ? 'Users will not be able to log in until re-enabled.'
                                                : 'Users will be able to log in again.'}
                                        </DialogDescription>
                                    </DialogHeader>
                                    <DialogFooter>
                                        <DialogClose asChild>
                                            <Button variant="outline">Cancel</Button>
                                        </DialogClose>
                                        <DialogClose asChild>
                                            <Button
                                                variant={tenant.enabled ? 'destructive' : 'default'}
                                                disabled={isPending}
                                                onClick={() =>
                                                    doAction(() =>
                                                        toggleEnabledAction(tenant.slug, !tenant.enabled)
                                                    )
                                                }
                                            >
                                                Confirm
                                            </Button>
                                        </DialogClose>
                                    </DialogFooter>
                                </DialogContent>
                            </Dialog>
                        </CardContent>
                    </Card>

                    {/* Delete */}
                    <Card className="border-red-200">
                        <CardHeader>
                            <CardTitle className="text-red-700">Delete Tenant</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-sm text-slate-600 mb-4">
                                Permanently removes this tenant and all associated Redis keys. This cannot be undone.
                            </p>
                            <Dialog>
                                <DialogTrigger asChild>
                                    <Button variant="destructive">🗑️ Delete tenant</Button>
                                </DialogTrigger>
                                <DialogContent>
                                    <DialogHeader>
                                        <DialogTitle>Delete {tenant.name}?</DialogTitle>
                                        <DialogDescription>
                                            This will permanently remove the tenant <strong>{tenant.slug}</strong> and all
                                            associated data from Redis. This action cannot be undone.
                                        </DialogDescription>
                                    </DialogHeader>
                                    <div className="my-3 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
                                        Type the slug <strong>{tenant.slug}</strong> to confirm — or just click delete.
                                    </div>
                                    <DialogFooter>
                                        <DialogClose asChild>
                                            <Button variant="outline">Cancel</Button>
                                        </DialogClose>
                                        <Button
                                            variant="destructive"
                                            disabled={isPending}
                                            onClick={() => doAction(() => deleteTenantAction(tenant.slug))}
                                        >
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
