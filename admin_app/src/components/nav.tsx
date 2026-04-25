'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOut } from 'next-auth/react';
import { cn } from '@/lib/utils';

const navLinks = [
    { href: '/', label: 'Dashboard', icon: '📊' },
    { href: '/clients', label: 'Clients', icon: '🏢' },
    { href: '/billing', label: 'Billing', icon: '💳' },
];

export function Sidebar() {
    const pathname = usePathname();

    return (
        <aside className="flex h-full w-56 flex-col border-r border-slate-200 bg-white shrink-0">
            {/* Brand */}
            <div className="px-5 py-4 border-b border-slate-100">
                <div className="flex items-center gap-2.5">
                    <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-900 text-sm">
                        🛡️
                    </span>
                    <div>
                        <p className="text-sm font-bold text-slate-900 leading-none">Shadow Portal</p>
                        <p className="text-xs text-slate-400 mt-0.5">Admin</p>
                    </div>
                </div>
            </div>

            {/* Nav */}
            <nav className="flex-1 px-3 py-4 space-y-0.5">
                {navLinks.map(({ href, label, icon }) => {
                    const active =
                        href === '/' ? pathname === '/' : pathname.startsWith(href);
                    return (
                        <Link
                            key={href}
                            href={href}
                            className={cn(
                                'flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                                active
                                    ? 'bg-slate-900 text-white'
                                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                            )}
                        >
                            <span className="text-base leading-none">{icon}</span>
                            {label}
                        </Link>
                    );
                })}
            </nav>

            {/* Sign out */}
            <div className="px-3 py-3 border-t border-slate-100">
                <button
                    onClick={() => signOut({ callbackUrl: '/login' })}
                    className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-slate-500 hover:bg-slate-50 hover:text-slate-700 transition-colors"
                >
                    <span className="text-base leading-none">🚪</span>
                    Sign out
                </button>
            </div>
        </aside>
    );
}
