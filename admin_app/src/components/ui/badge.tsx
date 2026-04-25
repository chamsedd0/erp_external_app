import { cn } from '@/lib/utils';

interface BadgeProps {
    children: React.ReactNode;
    variant?: 'default' | 'success' | 'warning' | 'danger' | 'info' | 'muted';
    className?: string;
}

const variants: Record<NonNullable<BadgeProps['variant']>, string> = {
    default: 'bg-slate-100 text-slate-700',
    success: 'bg-emerald-100 text-emerald-700',
    warning: 'bg-amber-100 text-amber-700',
    danger: 'bg-red-100 text-red-700',
    info: 'bg-blue-100 text-blue-700',
    muted: 'bg-slate-100 text-slate-500',
};

export function Badge({ children, variant = 'default', className }: BadgeProps) {
    return (
        <span className={cn('inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium', variants[variant], className)}>
            {children}
        </span>
    );
}

// ── Specialised badges ────────────────────────────────────────────────────────

type SubStatus = 'trial' | 'active' | 'overdue' | 'suspended' | 'cancelled';
type PlanType = 'starter' | 'professional' | 'enterprise';

const statusVariants: Record<SubStatus, BadgeProps['variant']> = {
    active: 'success',
    trial: 'warning',
    overdue: 'danger',
    suspended: 'muted',
    cancelled: 'muted',
};

const planVariants: Record<PlanType, BadgeProps['variant']> = {
    starter: 'muted',
    professional: 'info',
    enterprise: 'warning',
};

export function StatusBadge({ status }: { status: SubStatus }) {
    return <Badge variant={statusVariants[status]}>{status}</Badge>;
}

export function PlanBadge({ plan }: { plan: PlanType }) {
    return <Badge variant={planVariants[plan]}>{plan}</Badge>;
}
