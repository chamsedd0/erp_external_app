'use client';
import { cn } from '@/lib/utils';

interface HealthDotProps {
    status: 'ok' | 'error' | 'unknown';
    latency?: number;
}

export function HealthDot({ status, latency }: HealthDotProps) {
    const colors = {
        ok: 'bg-emerald-500',
        error: 'bg-red-500',
        unknown: 'bg-slate-300',
    };
    const labels = {
        ok: latency ? `Online (${latency}ms)` : 'Online',
        error: 'Unreachable',
        unknown: 'Unknown',
    };
    return (
        <span className="inline-flex items-center gap-1.5" title={labels[status]}>
            <span className={cn('h-2 w-2 rounded-full', colors[status])} />
            <span className="text-xs text-slate-500">{labels[status]}</span>
        </span>
    );
}
