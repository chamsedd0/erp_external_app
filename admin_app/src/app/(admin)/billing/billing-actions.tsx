'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { updateStatusAction } from '@/lib/actions';
import { Check, PauseCircle } from 'lucide-react';

export function BillingActions({ slug }: { slug: string }) {
    const [isPending, startTransition] = useTransition();
    const [hover, setHover] = useState('');
    const router = useRouter();

    function doStatus(status: 'active' | 'suspended') {
        startTransition(async () => {
            await updateStatusAction(slug, status);
            router.refresh();
        });
    }

    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 12 }}>
            <button
                onClick={() => doStatus('active')}
                disabled={isPending}
                onMouseEnter={() => setHover('paid')}
                onMouseLeave={() => setHover('')}
                style={{
                    display: 'inline-flex', alignItems: 'center', gap: 5,
                    height: 28, padding: '0 10px', borderRadius: 6,
                    fontSize: 12, fontWeight: 500,
                    background: hover === 'paid' ? '#6EE7B7' : '#D1FAE5',
                    color: '#065F46',
                    border: 'none', cursor: isPending ? 'not-allowed' : 'pointer',
                    opacity: isPending ? 0.5 : 1,
                    transition: 'background 100ms ease',
                    fontFamily: 'inherit',
                }}
            >
                <Check size={12} />Mark Paid
            </button>
            <button
                onClick={() => doStatus('suspended')}
                disabled={isPending}
                onMouseEnter={() => setHover('suspend')}
                onMouseLeave={() => setHover('')}
                style={{
                    display: 'inline-flex', alignItems: 'center', gap: 5,
                    height: 28, padding: '0 10px', borderRadius: 6,
                    fontSize: 12, fontWeight: 500,
                    background: hover === 'suspend' ? '#E2E8F0' : '#F1F5F9',
                    color: '#475569',
                    border: '1px solid #E2E8F0', cursor: isPending ? 'not-allowed' : 'pointer',
                    opacity: isPending ? 0.5 : 1,
                    transition: 'background 100ms ease',
                    fontFamily: 'inherit',
                }}
            >
                <PauseCircle size={12} />Suspend
            </button>
        </div>
    );
}
