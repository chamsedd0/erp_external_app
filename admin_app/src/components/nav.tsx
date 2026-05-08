'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOut } from 'next-auth/react';
import { LayoutDashboard, Building2, CreditCard, LogOut } from 'lucide-react';
import { useState } from 'react';

const navItems = [
    { href: '/',        label: 'Dashboard', icon: LayoutDashboard },
    { href: '/clients', label: 'Clients',   icon: Building2       },
    { href: '/billing', label: 'Billing',   icon: CreditCard      },
];

function NavLink({
    href,
    label,
    icon: Icon,
    active,
    muted,
    onClick,
}: {
    href?: string;
    label: string;
    icon: React.ElementType;
    active: boolean;
    muted?: boolean;
    onClick?: () => void;
}) {
    const [hover, setHover] = useState(false);

    const baseStyle: React.CSSProperties = {
        position: 'relative',
        height: 40,
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '0 12px',
        borderRadius: 8,
        background: active ? '#1E293B' : hover ? 'rgba(30,41,59,0.5)' : 'transparent',
        color: active ? '#fff' : muted ? '#94A3B8' : hover ? '#E2E8F0' : '#94A3B8',
        border: 'none',
        cursor: 'pointer',
        fontSize: 14,
        fontWeight: active ? 500 : 400,
        textAlign: 'left',
        transition: 'background 120ms ease, color 120ms ease',
        width: '100%',
        textDecoration: 'none',
        fontFamily: 'inherit',
    };

    const content = (
        <>
            {active && (
                <span style={{
                    position: 'absolute',
                    left: 0, top: 8, bottom: 8,
                    width: 3,
                    borderRadius: 2,
                    background: '#3B82F6',
                }} />
            )}
            <span style={{ display: 'inline-flex', marginLeft: active ? 4 : 0 }}>
                <Icon size={16} />
            </span>
            <span>{label}</span>
        </>
    );

    if (href) {
        return (
            <Link
                href={href}
                style={baseStyle}
                onMouseEnter={() => setHover(true)}
                onMouseLeave={() => setHover(false)}
            >
                {content}
            </Link>
        );
    }

    return (
        <button
            onClick={onClick}
            onMouseEnter={() => setHover(true)}
            onMouseLeave={() => setHover(false)}
            style={baseStyle}
        >
            {content}
        </button>
    );
}

export function Sidebar() {
    const pathname = usePathname();

    const activeKey = (href: string) => {
        if (href === '/') return pathname === '/';
        return pathname.startsWith(href);
    };

    return (
        <aside style={{
            width: 240,
            flexShrink: 0,
            background: '#0F172A',
            display: 'flex',
            flexDirection: 'column',
            height: '100vh',
            position: 'sticky',
            top: 0,
        }}>
            {/* Brand */}
            <div style={{
                padding: '20px 20px 18px',
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                borderBottom: '1px solid rgba(255,255,255,0.04)',
            }}>
                <div style={{
                    width: 32, height: 32,
                    borderRadius: 8,
                    background: 'linear-gradient(135deg, #3B82F6, #1D4ED8)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#fff',
                    boxShadow: '0 4px 12px rgba(59,130,246,0.3)',
                    flexShrink: 0,
                    fontSize: 13,
                    fontWeight: 800,
                    letterSpacing: -0.5,
                    fontFamily: 'system-ui, sans-serif',
                }}>
                    SP
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                    <div style={{ color: '#fff', fontSize: 15, fontWeight: 700, letterSpacing: -0.2 }}>
                        Shadow Portal
                    </div>
                    <div style={{ color: '#64748B', fontSize: 11, fontWeight: 500, textTransform: 'uppercase', letterSpacing: 0.6 }}>
                        Admin
                    </div>
                </div>
            </div>

            {/* Nav */}
            <nav style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 2, flex: 1 }}>
                {navItems.map(({ href, label, icon }) => (
                    <NavLink
                        key={href}
                        href={href}
                        label={label}
                        icon={icon}
                        active={activeKey(href)}
                    />
                ))}
            </nav>

            {/* User block + sign out */}
            <div style={{ padding: 12, borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '8px 10px',
                    marginBottom: 6,
                    borderRadius: 8,
                }}>
                    <div style={{
                        width: 28, height: 28,
                        borderRadius: 999,
                        background: '#1E293B',
                        color: '#94A3B8',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 12,
                        fontWeight: 600,
                        flexShrink: 0,
                    }}>
                        OP
                    </div>
                    <div style={{ minWidth: 0 }}>
                        <div style={{ color: '#E2E8F0', fontSize: 13, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            Owner
                        </div>
                        <div style={{ color: '#64748B', fontSize: 11 }}>
                            operator@shadowportal
                        </div>
                    </div>
                </div>
                <NavLink
                    label="Sign out"
                    icon={LogOut}
                    active={false}
                    muted
                    onClick={() => signOut({ callbackUrl: '/login' })}
                />
            </div>
        </aside>
    );
}
