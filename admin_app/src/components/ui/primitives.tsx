'use client';

import React, { useState, useEffect, CSSProperties } from 'react';

// ── Button ────────────────────────────────────────────────────────────────────

type ButtonVariant = 'default' | 'secondary' | 'ghost' | 'danger' | 'outline';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: ButtonVariant;
    size?: ButtonSize;
    leftIcon?: React.ReactNode;
    rightIcon?: React.ReactNode;
}

export function Btn({
    variant = 'default',
    size = 'md',
    leftIcon,
    rightIcon,
    children,
    style,
    disabled,
    ...rest
}: ButtonProps) {
    const sizes: Record<ButtonSize, { height: number; paddingX: number; fontSize: number; gap: number }> = {
        md: { height: 36, paddingX: 16, fontSize: 14, gap: 6 },
        sm: { height: 30, paddingX: 12, fontSize: 13, gap: 5 },
        lg: { height: 40, paddingX: 18, fontSize: 14, gap: 8 },
    };
    const variants: Record<ButtonVariant, { bg: string; color: string; border: string; hoverBg: string }> = {
        default:   { bg: '#0F172A', color: '#fff',     border: '#0F172A', hoverBg: '#1E293B' },
        secondary: { bg: '#fff',    color: '#0F172A',  border: '#E2E8F0', hoverBg: '#F8FAFC' },
        ghost:     { bg: 'transparent', color: '#475569', border: 'transparent', hoverBg: '#F1F5F9' },
        danger:    { bg: '#DC2626', color: '#fff',     border: '#DC2626', hoverBg: '#B91C1C' },
        outline:   { bg: '#fff',    color: '#0F172A',  border: '#CBD5E1', hoverBg: '#F8FAFC' },
    };
    const s = sizes[size];
    const v = variants[variant];
    const [hover, setHover] = useState(false);

    return (
        <button
            className="btn-press"
            onMouseEnter={() => setHover(true)}
            onMouseLeave={() => setHover(false)}
            disabled={disabled}
            style={{
                height: s.height,
                padding: `0 ${s.paddingX}px`,
                fontSize: s.fontSize,
                fontWeight: 500,
                background: hover && !disabled ? v.hoverBg : v.bg,
                color: v.color,
                border: `1px solid ${v.border}`,
                borderRadius: 8,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: s.gap,
                cursor: disabled ? 'not-allowed' : 'pointer',
                opacity: disabled ? 0.5 : 1,
                transition: 'background 120ms ease, transform 80ms ease',
                whiteSpace: 'nowrap',
                fontFamily: 'inherit',
                ...style,
            }}
            {...rest}
        >
            {leftIcon}{children}{rightIcon}
        </button>
    );
}

// ── Card ──────────────────────────────────────────────────────────────────────

interface CardProps {
    children: React.ReactNode;
    style?: CSSProperties;
    hoverable?: boolean;
    onClick?: () => void;
    padding?: number | string;
}

export function DSCard({ children, style, hoverable, onClick, padding }: CardProps) {
    const [hover, setHover] = useState(false);
    return (
        <div
            onClick={onClick}
            onMouseEnter={() => setHover(true)}
            onMouseLeave={() => setHover(false)}
            style={{
                background: '#fff',
                border: `1px solid ${hoverable && hover ? '#CBD5E1' : '#E2E8F0'}`,
                borderRadius: 12,
                boxShadow: hoverable && hover
                    ? '0 4px 14px rgba(15,23,42,0.06)'
                    : '0 1px 3px rgba(15,23,42,0.04)',
                transition: 'box-shadow 150ms ease, border-color 150ms ease',
                cursor: onClick ? 'pointer' : 'default',
                padding,
                ...style,
            }}
        >
            {children}
        </div>
    );
}

export function DSCardHeader({
    title,
    subtitle,
    action,
    style,
}: {
    title: React.ReactNode;
    subtitle?: React.ReactNode;
    action?: React.ReactNode;
    style?: CSSProperties;
}) {
    return (
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', padding: '20px 20px 12px', ...style }}>
            <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: '#0F172A' }}>{title}</div>
                {subtitle && <div style={{ fontSize: 12, color: '#94A3B8', marginTop: 2 }}>{subtitle}</div>}
            </div>
            {action}
        </div>
    );
}

export function DSCardContent({ children, style }: { children: React.ReactNode; style?: CSSProperties }) {
    return <div style={{ padding: '0 20px 20px', ...style }}>{children}</div>;
}

// ── Badges ────────────────────────────────────────────────────────────────────

type StatusKey = 'active' | 'trial' | 'overdue' | 'suspended' | 'cancelled' | 'draft';
type PlanKey = 'starter' | 'professional' | 'enterprise';

const STATUS_STYLES: Record<StatusKey, { bg: string; text: string; border: string }> = {
    active:    { bg: '#D1FAE5', text: '#065F46', border: '#6EE7B7' },
    trial:     { bg: '#FEF3C7', text: '#92400E', border: '#FCD34D' },
    overdue:   { bg: '#FEE2E2', text: '#991B1B', border: '#FCA5A5' },
    suspended: { bg: '#F1F5F9', text: '#475569', border: '#CBD5E1' },
    cancelled: { bg: '#F1F5F9', text: '#6B7280', border: '#E2E8F0' },
    draft:     { bg: '#FFF7ED', text: '#9A3412', border: '#FED7AA' },
};
const PLAN_STYLES: Record<PlanKey, { bg: string; text: string; border: string }> = {
    starter:      { bg: '#F1F5F9', text: '#475569', border: '#E2E8F0' },
    professional: { bg: '#EFF6FF', text: '#1D4ED8', border: '#BFDBFE' },
    enterprise:   { bg: '#FFFBEB', text: '#92400E', border: '#FDE68A' },
};

const pillStyle: CSSProperties = {
    display: 'inline-flex', alignItems: 'center',
    height: 20, padding: '0 8px',
    fontSize: 11, fontWeight: 500, letterSpacing: 0.4, textTransform: 'uppercase',
    borderRadius: 999,
};

export function DSStatusBadge({ status }: { status: string }) {
    const s = STATUS_STYLES[status as StatusKey] ?? STATUS_STYLES.suspended;
    return (
        <span style={{ ...pillStyle, background: s.bg, color: s.text, border: `1px solid ${s.border}` }}>
            {status}
        </span>
    );
}

export function DSPlanBadge({ plan }: { plan: string }) {
    const s = PLAN_STYLES[plan as PlanKey] ?? PLAN_STYLES.starter;
    return (
        <span style={{ ...pillStyle, background: s.bg, color: s.text, border: `1px solid ${s.border}` }}>
            {plan}
        </span>
    );
}

// ── Health dot ────────────────────────────────────────────────────────────────

export function DSHealthDot({
    state,
    label,
    latencyMs,
}: {
    state: 'online' | 'error' | 'unknown';
    label?: string;
    latencyMs?: number;
}) {
    const colors = { online: '#10B981', error: '#EF4444', unknown: '#94A3B8' };
    const c = colors[state];
    const text = label
        ?? (state === 'online' ? `Online${latencyMs ? ` (${latencyMs}ms)` : ''}` : state === 'error' ? 'Error' : 'Checking…');
    return (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <span
                className={state === 'unknown' ? 'pulse-dot' : ''}
                style={{
                    width: 8, height: 8, borderRadius: 999, background: c, flexShrink: 0,
                    boxShadow: state === 'online' ? '0 0 0 3px rgba(16,185,129,0.15)' : 'none',
                }}
            />
            <span style={{ fontSize: 12, color: '#64748B' }}>{text}</span>
        </span>
    );
}

// ── Renewal badge ─────────────────────────────────────────────────────────────

export function DSRenewalBadge({ date }: { date: string }) {
    if (!date) return <span style={{ fontSize: 13, color: '#94A3B8' }}>Pending activation</span>;
    const today = new Date();
    const target = new Date(date);
    const diffDays = Math.round((target.getTime() - today.getTime()) / 86400000);
    const dateStr = target.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

    if (diffDays < 0) {
        return (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: '#DC2626', fontSize: 13, fontWeight: 500 }}>
                {/* AlertCircle inline */}
                <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                    <circle cx="12" cy="12" r="10"/><path d="M12 8v4"/><path d="M12 16h.01"/>
                </svg>
                {dateStr} <span style={{ color: '#B91C1C' }}>({Math.abs(diffDays)}d overdue)</span>
            </span>
        );
    }
    if (diffDays <= 7) {
        return (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: '#D97706', fontSize: 13, fontWeight: 500 }}>
                <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                    <circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>
                </svg>
                {dateStr} <span style={{ color: '#92400E' }}>({diffDays}d)</span>
            </span>
        );
    }
    return <span style={{ color: '#475569', fontSize: 13 }}>{dateStr}</span>;
}

// ── Form fields ───────────────────────────────────────────────────────────────

export function DSField({
    label,
    hint,
    error,
    required,
    children,
}: {
    label?: string;
    hint?: string;
    error?: string;
    required?: boolean;
    children: React.ReactNode;
}) {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {label && (
                <label style={{ fontSize: 13, fontWeight: 500, color: '#334155' }}>
                    {label}{required && <span style={{ color: '#EF4444', marginLeft: 2 }}>*</span>}
                </label>
            )}
            {children}
            {error ? (
                <div style={{ fontSize: 12, color: '#B91C1C', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="10"/><path d="M12 8v4"/><path d="M12 16h.01"/>
                    </svg>
                    {error}
                </div>
            ) : hint ? (
                <div style={{ fontSize: 12, color: '#94A3B8' }}>{hint}</div>
            ) : null}
        </div>
    );
}

interface TextInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
    leftIcon?: React.ReactNode;
    rightIcon?: React.ReactNode;
    error?: string;
}

export function DSTextInput({ leftIcon, rightIcon, error, style, ...rest }: TextInputProps) {
    const [focus, setFocus] = useState(false);
    return (
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
            {leftIcon && (
                <span style={{ position: 'absolute', left: 11, color: '#94A3B8', pointerEvents: 'none', display: 'inline-flex' }}>
                    {leftIcon}
                </span>
            )}
            <input
                onFocus={() => setFocus(true)}
                onBlur={() => setFocus(false)}
                style={{
                    width: '100%',
                    height: 36,
                    padding: leftIcon ? '0 12px 0 34px' : '0 12px',
                    paddingRight: rightIcon ? 34 : 12,
                    fontSize: 14,
                    color: '#0F172A',
                    background: error ? '#FEF2F2' : '#fff',
                    border: `1px solid ${error ? '#FCA5A5' : focus ? '#60A5FA' : '#CBD5E1'}`,
                    borderRadius: 8,
                    outline: 'none',
                    boxShadow: focus ? '0 0 0 3px rgba(59,130,246,0.18)' : 'none',
                    transition: 'box-shadow 120ms, border-color 120ms',
                    fontFamily: 'inherit',
                    ...style,
                }}
                {...rest}
            />
            {rightIcon && (
                <span style={{ position: 'absolute', right: 8, color: '#94A3B8', display: 'inline-flex' }}>
                    {rightIcon}
                </span>
            )}
        </div>
    );
}

export function DSTextarea({ error, style, ...rest }: React.TextareaHTMLAttributes<HTMLTextAreaElement> & { error?: string }) {
    const [focus, setFocus] = useState(false);
    return (
        <textarea
            onFocus={() => setFocus(true)}
            onBlur={() => setFocus(false)}
            style={{
                width: '100%',
                minHeight: 80,
                padding: '8px 12px',
                fontSize: 14,
                fontFamily: 'inherit',
                color: '#0F172A',
                background: error ? '#FEF2F2' : '#fff',
                border: `1px solid ${error ? '#FCA5A5' : focus ? '#60A5FA' : '#CBD5E1'}`,
                borderRadius: 8,
                outline: 'none',
                boxShadow: focus ? '0 0 0 3px rgba(59,130,246,0.18)' : 'none',
                resize: 'vertical',
                ...style,
            }}
            {...rest}
        />
    );
}

interface SelectInputProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
    options: { value: string; label: string }[];
}

export function DSSelectInput({ options, style, ...rest }: SelectInputProps) {
    const [focus, setFocus] = useState(false);
    return (
        <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', width: '100%' }}>
            <select
                onFocus={() => setFocus(true)}
                onBlur={() => setFocus(false)}
                style={{
                    width: '100%',
                    height: 36,
                    padding: '0 36px 0 12px',
                    fontSize: 14,
                    color: '#0F172A',
                    background: '#fff',
                    border: `1px solid ${focus ? '#60A5FA' : '#CBD5E1'}`,
                    borderRadius: 8,
                    outline: 'none',
                    boxShadow: focus ? '0 0 0 3px rgba(59,130,246,0.18)' : 'none',
                    appearance: 'none',
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                    ...style,
                }}
                {...rest}
            >
                {options.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                ))}
            </select>
            {/* chevron-down */}
            <span style={{ position: 'absolute', right: 10, color: '#94A3B8', pointerEvents: 'none' }}>
                <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                    <path d="m6 9 6 6 6-6"/>
                </svg>
            </span>
        </div>
    );
}

// ── Stat card ────────────────────────────────────────────────────────────────

type TintKey = 'slate' | 'emerald' | 'red' | 'blue' | 'amber' | 'orange' | 'purple';

export function DSStatCard({
    label,
    value,
    subtitle,
    icon,
    tint = 'slate',
    valueColor,
}: {
    label: string;
    value: React.ReactNode;
    subtitle?: string;
    icon: React.ReactNode;
    tint?: TintKey;
    valueColor?: string;
}) {
    const tints: Record<TintKey, { bg: string; fg: string }> = {
        slate:   { bg: '#F1F5F9', fg: '#475569' },
        emerald: { bg: '#D1FAE5', fg: '#059669' },
        red:     { bg: '#FEE2E2', fg: '#DC2626' },
        blue:    { bg: '#DBEAFE', fg: '#2563EB' },
        amber:   { bg: '#FEF3C7', fg: '#D97706' },
        orange:  { bg: '#FFEDD5', fg: '#EA580C' },
        purple:  { bg: '#EDE9FE', fg: '#7C3AED' },
    };
    const t = tints[tint];
    return (
        <DSCard padding={20}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
                <div style={{
                    width: 36, height: 36, borderRadius: 8,
                    background: t.bg, color: t.fg,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                }}>{icon}</div>
                <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: '#64748B', textTransform: 'uppercase', letterSpacing: 0.6 }}>{label}</div>
                    <div style={{ fontSize: 28, fontWeight: 700, color: valueColor ?? '#0F172A', lineHeight: 1.1, marginTop: 4 }}>{value}</div>
                    {subtitle && <div style={{ fontSize: 12, color: '#94A3B8', marginTop: 4 }}>{subtitle}</div>}
                </div>
            </div>
        </DSCard>
    );
}

// ── Mono chip ─────────────────────────────────────────────────────────────────

export function MonoChip({ children, size = 13 }: { children: React.ReactNode; size?: number }) {
    return (
        <code className="mono" style={{
            display: 'inline-block',
            padding: '2px 6px',
            borderRadius: 4,
            background: '#F1F5F9',
            color: '#475569',
            fontSize: size,
            fontWeight: 500,
        }}>{children}</code>
    );
}

// ── Tabs ─────────────────────────────────────────────────────────────────────

export function DSTabs({
    value,
    onChange,
    items,
}: {
    value: string;
    onChange: (v: string) => void;
    items: { value: string; label: string; icon?: React.ReactNode }[];
}) {
    return (
        <div style={{ display: 'inline-flex', background: '#F1F5F9', borderRadius: 8, padding: 4, gap: 2 }}>
            {items.map((it) => {
                const active = it.value === value;
                return (
                    <button
                        key={it.value}
                        onClick={() => onChange(it.value)}
                        style={{
                            display: 'inline-flex', alignItems: 'center', gap: 6,
                            padding: '6px 12px', borderRadius: 6,
                            fontSize: 13, fontWeight: 500,
                            border: 'none', cursor: 'pointer',
                            background: active ? '#fff' : 'transparent',
                            color: active ? '#0F172A' : '#64748B',
                            boxShadow: active ? '0 1px 2px rgba(15,23,42,0.06)' : 'none',
                            transition: 'background 120ms ease, color 120ms ease',
                            fontFamily: 'inherit',
                        }}
                    >
                        {it.icon}{it.label}
                    </button>
                );
            })}
        </div>
    );
}

// ── Dialog ───────────────────────────────────────────────────────────────────

export function DSDialog({
    open,
    onClose,
    title,
    description,
    children,
    footer,
    danger,
}: {
    open: boolean;
    onClose?: () => void;
    title: string;
    description?: string;
    children?: React.ReactNode;
    footer?: React.ReactNode;
    danger?: string;
}) {
    useEffect(() => {
        if (!open) return;
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose?.(); };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [open, onClose]);

    if (!open) return null;
    return (
        <div style={{ position: 'fixed', inset: 0, zIndex: 100 }}>
            <div
                onClick={onClose}
                style={{
                    position: 'absolute', inset: 0,
                    background: 'rgba(15,23,42,0.32)',
                    backdropFilter: 'blur(4px)',
                    animation: 'overlayIn 140ms ease-out',
                }}
            />
            <div style={{
                position: 'absolute', top: '50%', left: '50%',
                transform: 'translate(-50%, -50%)',
                background: '#fff', borderRadius: 12,
                width: 'min(440px, calc(100vw - 32px))',
                padding: 24,
                boxShadow: '0 20px 50px rgba(15,23,42,0.18)',
                animation: 'dialogIn 160ms ease-out',
            }}>
                {danger && (
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: 12, marginBottom: 14, background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8 }}>
                        <span style={{ color: '#DC2626', flexShrink: 0 }}>
                            <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                                <circle cx="12" cy="12" r="10"/><path d="M12 8v4"/><path d="M12 16h.01"/>
                            </svg>
                        </span>
                        <div style={{ fontSize: 13, color: '#991B1B' }}>{danger}</div>
                    </div>
                )}
                <div style={{ fontSize: 16, fontWeight: 600, color: '#0F172A' }}>{title}</div>
                {description && <div style={{ fontSize: 14, color: '#64748B', marginTop: 4 }}>{description}</div>}
                {children && <div style={{ marginTop: 16 }}>{children}</div>}
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 24 }}>
                    {footer}
                </div>
            </div>
        </div>
    );
}

// ── Toast ────────────────────────────────────────────────────────────────────

export function DSToast({ message, onDismiss }: { message: string; onDismiss?: () => void }) {
    useEffect(() => {
        if (!message) return;
        const t = setTimeout(() => onDismiss?.(), 2400);
        return () => clearTimeout(t);
    }, [message, onDismiss]);

    if (!message) return null;
    return (
        <div style={{
            position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)',
            background: '#0F172A', color: '#fff',
            padding: '10px 16px', borderRadius: 10,
            boxShadow: '0 10px 30px rgba(15,23,42,0.18)',
            fontSize: 13, fontWeight: 500,
            display: 'flex', alignItems: 'center', gap: 8,
            zIndex: 200,
            animation: 'fadeIn 160ms ease-out',
        }}>
            <span style={{ color: '#34D399' }}>
                <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 6 9 17l-5-5"/>
                </svg>
            </span>
            {message}
        </div>
    );
}

// ── Page header ──────────────────────────────────────────────────────────────

export function DSPageHeader({
    title,
    subtitle,
    action,
}: {
    title: string;
    subtitle?: string;
    action?: React.ReactNode;
}) {
    return (
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: 24 }}>
            <div>
                <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700, color: '#0F172A', letterSpacing: -0.4 }}>{title}</h1>
                {subtitle && <div style={{ marginTop: 4, fontSize: 14, color: '#64748B' }}>{subtitle}</div>}
            </div>
            {action}
        </div>
    );
}

// ── Table helpers ─────────────────────────────────────────────────────────────

export function Th({
    label,
    active,
    dir,
    onClick,
    align = 'left',
}: {
    label: string;
    active?: boolean;
    dir?: 'asc' | 'desc';
    onClick?: () => void;
    align?: 'left' | 'right' | 'center';
}) {
    return (
        <th
            onClick={onClick}
            style={{
                padding: '10px 16px',
                textAlign: align,
                fontSize: 11, fontWeight: 600, color: '#64748B',
                textTransform: 'uppercase', letterSpacing: 0.6,
                cursor: onClick ? 'pointer' : 'default',
                userSelect: 'none',
                whiteSpace: 'nowrap',
            }}
        >
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                {label}
                {onClick && (
                    <span style={{ color: active ? '#0F172A' : '#CBD5E1', display: 'inline-flex' }}>
                        {active ? (
                            dir === 'asc' ? (
                                <svg width={11} height={11} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M12 19V5"/><path d="m5 12 7-7 7 7"/></svg>
                            ) : (
                                <svg width={11} height={11} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M12 5v14"/><path d="m19 12-7 7-7-7"/></svg>
                            )
                        ) : (
                            <svg width={11} height={11} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="m21 16-4 4-4-4"/><path d="M17 20V4"/><path d="m3 8 4-4 4 4"/><path d="M7 4v16"/></svg>
                        )}
                    </span>
                )}
            </span>
        </th>
    );
}

// ── MiniStat (used on detail page) ────────────────────────────────────────────

export function MiniStat({
    label,
    value,
    subtitle,
    icon,
}: {
    label: string;
    value: React.ReactNode;
    subtitle?: string;
    icon: React.ReactNode;
}) {
    return (
        <DSCard padding={16}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ fontSize: 11, fontWeight: 600, color: '#64748B', textTransform: 'uppercase', letterSpacing: 0.6 }}>{label}</span>
                <span style={{ color: '#94A3B8' }}>{icon}</span>
            </div>
            <div style={{ fontSize: 22, fontWeight: 700, color: '#0F172A', lineHeight: 1.1 }}>{value}</div>
            {subtitle && <div style={{ fontSize: 12, color: '#94A3B8', marginTop: 4 }}>{subtitle}</div>}
        </DSCard>
    );
}

// ── Row (key-value pair in detail cards) ─────────────────────────────────────

export function DetailRow({ label, value, last }: { label: string; value: React.ReactNode; last?: boolean }) {
    return (
        <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '10px 0',
            borderBottom: last ? 'none' : '1px solid #F1F5F9',
        }}>
            <span style={{ fontSize: 12, fontWeight: 500, color: '#94A3B8' }}>{label}</span>
            <span style={{ textAlign: 'right' }}>{value}</span>
        </div>
    );
}
