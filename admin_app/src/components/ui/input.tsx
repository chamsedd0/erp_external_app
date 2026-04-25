import { cn } from '@/lib/utils';
import { InputHTMLAttributes, forwardRef } from 'react';

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
    ({ className, ...props }, ref) => (
        <input
            ref={ref}
            className={cn(
                'flex h-9 w-full rounded-lg border border-slate-300 bg-white px-3 py-1 text-sm text-slate-900',
                'placeholder:text-slate-400',
                'focus:outline-none focus:ring-2 focus:ring-slate-400 focus:border-transparent',
                'disabled:opacity-50 disabled:cursor-not-allowed',
                className
            )}
            {...props}
        />
    )
);
Input.displayName = 'Input';

export function Label({ htmlFor, children, className }: { htmlFor?: string; children: React.ReactNode; className?: string }) {
    return (
        <label htmlFor={htmlFor} className={cn('block text-sm font-medium text-slate-700 mb-1', className)}>
            {children}
        </label>
    );
}

export function Textarea({
    className,
    ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
    return (
        <textarea
            className={cn(
                'flex min-h-[80px] w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900',
                'placeholder:text-slate-400',
                'focus:outline-none focus:ring-2 focus:ring-slate-400 focus:border-transparent',
                'disabled:opacity-50',
                className
            )}
            {...props}
        />
    );
}
