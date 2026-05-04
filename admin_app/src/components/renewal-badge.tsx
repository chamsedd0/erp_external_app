import { AlertCircle, Clock } from 'lucide-react';

export function RenewalBadge({ date }: { date: string }) {
    if (!date) return <span style={{ fontSize: 13, color: '#94A3B8' }}>—</span>;

    const renewal = new Date(date);
    const now = new Date();
    const daysUntil = Math.ceil((renewal.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    const formatted = renewal.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

    if (daysUntil < 0) {
        return (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 13, fontWeight: 500, color: '#DC2626' }}>
                <AlertCircle size={13} />
                {formatted} ({Math.abs(daysUntil)}d overdue)
            </span>
        );
    }
    if (daysUntil <= 7) {
        return (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 13, fontWeight: 500, color: '#D97706' }}>
                <Clock size={13} />
                {formatted} ({daysUntil}d)
            </span>
        );
    }
    return <span style={{ fontSize: 13, color: '#475569' }}>{formatted}</span>;
}
