'use client';

import * as RadixTabs from '@radix-ui/react-tabs';
import { cn } from '@/lib/utils';

export const Tabs = RadixTabs.Root;

export function TabsList({ children, className }: { children: React.ReactNode; className?: string }) {
    return (
        <RadixTabs.List
            className={cn(
                'inline-flex h-9 items-center rounded-lg bg-slate-100 p-1 text-slate-500',
                className
            )}
        >
            {children}
        </RadixTabs.List>
    );
}

export function TabsTrigger({
    value,
    children,
    className,
}: {
    value: string;
    children: React.ReactNode;
    className?: string;
}) {
    return (
        <RadixTabs.Trigger
            value={value}
            className={cn(
                'inline-flex items-center justify-center rounded-md px-3 py-1 text-sm font-medium transition-all',
                'data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-sm',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400',
                className
            )}
        >
            {children}
        </RadixTabs.Trigger>
    );
}

export function TabsContent({
    value,
    children,
    className,
}: {
    value: string;
    children: React.ReactNode;
    className?: string;
}) {
    return (
        <RadixTabs.Content
            value={value}
            className={cn('mt-4 focus-visible:outline-none', className)}
        >
            {children}
        </RadixTabs.Content>
    );
}
