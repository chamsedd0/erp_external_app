'use client';

import { useEffect, useState } from 'react';
import { HealthDot } from './health-dot';

interface Props {
    slug: string;
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
                style={{
                    display: 'inline-flex', alignItems: 'center', gap: 6,
                    background: 'transparent', border: 'none', cursor: loading ? 'not-allowed' : 'pointer',
                    fontSize: 12, color: '#475569', opacity: loading ? 0.5 : 1,
                    fontFamily: 'inherit', padding: 0,
                }}
            >
                {loading ? (
                    <>
                        <span className="pulse-dot" style={{ width: 8, height: 8, borderRadius: 999, background: '#94A3B8', flexShrink: 0 }} />
                        <span>Checking…</span>
                    </>
                ) : (
                    <HealthDot status={status} latency={latency} />
                )}
            </button>
        );
    }

    return loading ? (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <span className="pulse-dot" style={{ width: 8, height: 8, borderRadius: 999, background: '#94A3B8', flexShrink: 0 }} />
            <span style={{ fontSize: 12, color: '#94A3B8' }}>Checking…</span>
        </span>
    ) : (
        <HealthDot status={status} latency={latency} />
    );
}
