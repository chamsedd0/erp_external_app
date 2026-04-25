import { cn } from '@/lib/utils';

export function RenewalBadge({ date }: { date: string }) {
    if (!date) return <span className="text-sm text-slate-400">—</span>;

    const renewal = new Date(date);
    const now = new Date();
    const daysUntil = Math.ceil((renewal.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    const formatted = renewal.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

    if (daysUntil < 0) {
        return (
            <span className="inline-flex items-center gap-1 text-sm font-medium text-red-600">
                <span>🔴</span> {formatted} ({Math.abs(daysUntil)}d overdue)
            </span>
        );
    }
    if (daysUntil <= 7) {
        return (
            <span className="inline-flex items-center gap-1 text-sm font-medium text-amber-600">
                <span>🟡</span> {formatted} ({daysUntil}d)
            </span>
        );
    }
    return <span className="text-sm text-slate-600">{formatted}</span>;
}
