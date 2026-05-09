import Link from 'next/link';
import { notFound } from 'next/navigation';
import { api } from '@/lib/api';
import { TenantForm } from '@/components/tenant-form';
import { ChevronLeft } from 'lucide-react';

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
    const { slug } = await params;
    return { title: `Edit ${slug} — Shadow Portal Admin` };
}

export default async function EditClientPage({
    params,
}: {
    params: Promise<{ slug: string }>;
}) {
    const { slug } = await params;
    const [tenant, plans] = await Promise.all([
        api.getTenant(slug).catch(() => null),
        api.listPlans().catch(() => []),
    ]);
    if (!tenant) notFound();

    return (
        <div className="page-fade" style={{ padding: 32, maxWidth: 1280, margin: '0 auto' }}>
            <Link href={`/clients/${slug}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 13, color: '#64748B', textDecoration: 'none', marginBottom: 16 }}>
                <ChevronLeft size={14} />
                {tenant.name}
            </Link>
            <div style={{ marginBottom: 24 }}>
                <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700, color: '#0F172A', letterSpacing: -0.4 }}>
                    Edit {tenant.name}
                </h1>
                <div style={{ marginTop: 4, fontSize: 14, color: '#64748B' }}>
                    Update connection, contact, and subscription details
                </div>
            </div>
            <TenantForm tenant={tenant} plans={plans} />
        </div>
    );
}
