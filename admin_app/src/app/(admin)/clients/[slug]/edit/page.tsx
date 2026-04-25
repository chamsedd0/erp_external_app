import Link from 'next/link';
import { notFound } from 'next/navigation';
import { api } from '@/lib/api';
import { TenantForm } from '@/components/tenant-form';

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
    const tenant = await api.getTenant(slug).catch(() => null);

    if (!tenant) notFound();

    return (
        <div className="p-8 max-w-3xl mx-auto">
            <div className="mb-6">
                <Link
                    href={`/clients/${slug}`}
                    className="text-sm text-slate-500 hover:text-slate-700"
                >
                    ← Back to {tenant.name}
                </Link>
                <h1 className="text-2xl font-bold text-slate-900 mt-3">Edit Client</h1>
                <p className="text-sm text-slate-500 mt-1">
                    Update {tenant.name}&apos;s configuration and billing details.
                </p>
            </div>

            <TenantForm tenant={tenant} />
        </div>
    );
}
