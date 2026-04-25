'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { updateStatusAction } from '@/lib/actions';

export function BillingActions({ slug }: { slug: string }) {
    const [isPending, startTransition] = useTransition();
    const router = useRouter();

    function doStatus(status: 'active' | 'suspended') {
        startTransition(async () => {
            await updateStatusAction(slug, status);
            router.refresh();
        });
    }

    return (
        <div className="flex items-center gap-2 mt-2">
            <button
                onClick={() => doStatus('active')}
                disabled={isPending}
                className="h-7 rounded px-2.5 text-xs font-medium bg-emerald-100 text-emerald-700 hover:bg-emerald-200 transition-colors disabled:opacity-50"
            >
                ✓ Mark paid
            </button>
            <button
                onClick={() => doStatus('suspended')}
                disabled={isPending}
                className="h-7 rounded px-2.5 text-xs font-medium bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors disabled:opacity-50"
            >
                Suspend
            </button>
        </div>
    );
}
