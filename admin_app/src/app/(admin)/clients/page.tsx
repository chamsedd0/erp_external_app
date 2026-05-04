import Link from 'next/link';
import { api } from '@/lib/api';
import { ClientsTableClient } from './clients-table-client';
import { Plus } from 'lucide-react';

export default async function ClientsPage() {
    const tenants = await api.listTenants().catch(() => [] as Awaited<ReturnType<typeof api.listTenants>>);

    return (
        <div className="page-fade" style={{ padding: 32, maxWidth: 1280, margin: '0 auto' }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: 24 }}>
                <div>
                    <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700, color: '#0F172A', letterSpacing: -0.4 }}>Clients</h1>
                    <div style={{ marginTop: 4, fontSize: 14, color: '#64748B' }}>
                        {tenants.length} tenant{tenants.length !== 1 ? 's' : ''} · {tenants.filter(t => t.subscription_status === 'active').length} active
                    </div>
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

            <ClientsTableClient tenants={tenants} />
        </div>
    );
}
