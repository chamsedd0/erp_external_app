import Link from 'next/link';
import { api } from '@/lib/api';
import { StatusBadge, PlanBadge } from '@/components/ui/badge';
import { RenewalBadge } from '@/components/renewal-badge';
import { HealthCheck } from '@/components/health-check';
import { ClientsTableClient } from './clients-table-client';

export default async function ClientsPage() {
    const tenants = await api.listTenants().catch(() => [] as Awaited<ReturnType<typeof api.listTenants>>);

    return (
        <div className="p-8 max-w-7xl mx-auto">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">Clients</h1>
                    <p className="text-sm text-slate-500 mt-0.5">
                        {tenants.length} tenant{tenants.length !== 1 ? 's' : ''} configured
                    </p>
                </div>
                <Link
                    href="/clients/new"
                    className="inline-flex items-center gap-1.5 h-9 rounded-lg bg-slate-900 text-white text-sm font-medium px-4 hover:bg-slate-800 transition-colors"
                >
                    + Add New Client
                </Link>
            </div>

            <ClientsTableClient tenants={tenants} />
        </div>
    );
}
