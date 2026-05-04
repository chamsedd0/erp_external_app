'use client';

interface HealthDotProps {
    status: 'ok' | 'error' | 'unknown';
    latency?: number;
}

export function HealthDot({ status, latency }: HealthDotProps) {
    const colors = {
        ok:      '#10B981',
        error:   '#EF4444',
        unknown: '#94A3B8',
    };
    const labels = {
        ok:      latency ? `Online (${latency}ms)` : 'Online',
        error:   'Unreachable',
        unknown: 'Checking…',
    };
    return (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <span
                className={status === 'unknown' ? 'pulse-dot' : ''}
                style={{
                    width: 8, height: 8,
                    borderRadius: 999,
                    background: colors[status],
                    flexShrink: 0,
                    boxShadow: status === 'ok' ? '0 0 0 3px rgba(16,185,129,0.15)' : 'none',
                }}
            />
            <span style={{ fontSize: 12, color: '#64748B' }}>{labels[status]}</span>
        </span>
    );
}
