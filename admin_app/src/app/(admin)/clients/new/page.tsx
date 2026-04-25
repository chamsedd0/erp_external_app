import Link from 'next/link';
import { TenantForm } from '@/components/tenant-form';

export const metadata = { title: 'Add New Client — Shadow Portal Admin' };

export default function NewClientPage() {
    return (
        <div className="p-8 max-w-3xl mx-auto">
            <div className="mb-6">
                <Link href="/clients" className="text-sm text-slate-500 hover:text-slate-700">
                    ← Back to clients
                </Link>
                <h1 className="text-2xl font-bold text-slate-900 mt-3">Add New Client</h1>
                <p className="text-sm text-slate-500 mt-1">
                    Configure a new tenant and their Odoo connection.
                </p>
            </div>

            <TenantForm isNew />
        </div>
    );
}
