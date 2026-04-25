'use client';

import { useEffect, useState } from 'react';
import { HealthDot } from './health-dot';

interface Props {
    slug: string;
    /** pass true to skip auto-fetch on mount (manual trigger only) */
    manual?: boolean;
}

export function HealthCheck({ slug, manual = false }: Props) {
    const [status, setStatus] = useState<'ok' | 'error' | 'unknown'>('unknown');
    const [latency, setLatency] = useState<number | undefined>(undefined);
    const [loading, setLoading] = useState(false);

    async function fetchHealth() {
        setLoading(true);
        try {
            const res = await fetch(`/api/admin/health/${slug}`);
            const data = await res.json();
            setStatus(data.ok ? 'ok' : 'error');
            setLatency(data.latency_ms);
        } catch {
            setStatus('error');
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        if (!manual) fetchHealth();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [slug, manual]);

    if (manual) {
        return (
            <button
                onClick={fetchHealth}
                disabled={loading}
                className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-700 disabled:opacity-50"
            >
                {loading ? (
                    <span className="h-2 w-2 rounded-full bg-slate-300 animate-pulse" />
                ) : (
                    <HealthDot status={status} latency={latency} />
                )}
                {loading ? 'Checking…' : 'Test connection'}
            </button>
        );
    }

    if (loading) {
        return (
            <span className="inline-flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-slate-200 animate-pulse" />
                <span className="text-xs text-slate-400">Checking…</span>
            </span>
        );
    }

    return <HealthDot status={status} latency={latency} />;
}
