import Link from 'next/link';
import { api } from '@/lib/api';
import { DraftClientForm } from '@/components/draft-client-form';
import { ChevronLeft } from 'lucide-react';

export const metadata = { title: 'Add New Client — Shadow Portal Admin' };

export default async function NewClientPage() {
    const plans = await api.listPlans().catch(() => []);

    return (
        <div className="page-fade" style={{ padding: 32, maxWidth: 1280, margin: '0 auto' }}>
            <Link href="/clients" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 13, color: '#64748B', textDecoration: 'none', marginBottom: 16 }}>
                <ChevronLeft size={14} />
                Clients
            </Link>
            <div style={{ marginBottom: 24 }}>
                <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700, color: '#0F172A', letterSpacing: -0.4 }}>Add New Client</h1>
                <div style={{ marginTop: 4, fontSize: 14, color: '#64748B' }}>
                    Start a quote — Odoo credentials can be added after the client approves
                </div>
            </div>
            <DraftClientForm plans={plans} />
        </div>
    );
}
