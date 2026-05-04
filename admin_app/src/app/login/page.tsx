'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Shield, Eye, EyeOff, AlertCircle } from 'lucide-react';

export default function LoginPage() {
    const [password, setPassword] = useState('');
    const [show, setShow] = useState(false);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const router = useRouter();

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setLoading(true);
        setError('');

        const res = await signIn('credentials', { password, redirect: false });

        if (res?.ok) {
            router.push('/');
            router.refresh();
        } else {
            setError('Invalid password');
            setLoading(false);
        }
    }

    return (
        <div style={{
            minHeight: '100vh',
            background: '#F8FAFC',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 24,
        }}>
            <div style={{ width: '100%', maxWidth: 360 }}>
                {/* Header */}
                <div style={{ textAlign: 'center', marginBottom: 28 }}>
                    <div style={{
                        width: 48, height: 48,
                        borderRadius: 14,
                        background: '#0F172A',
                        color: '#fff',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        marginBottom: 16,
                        boxShadow: '0 8px 24px rgba(15,23,42,0.18)',
                    }}>
                        <Shield size={22} />
                    </div>
                    <div style={{ fontSize: 22, fontWeight: 700, color: '#0F172A', letterSpacing: -0.4 }}>
                        Shadow Portal
                    </div>
                    <div style={{ fontSize: 13, color: '#64748B', marginTop: 4 }}>
                        Admin Dashboard
                    </div>
                </div>

                {/* Card */}
                <div style={{
                    background: '#fff',
                    borderRadius: 12,
                    border: '1px solid #E2E8F0',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
                    padding: 32,
                }}>
                    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                        {/* Password field */}
                        <div>
                            <label
                                htmlFor="password"
                                style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#334155', marginBottom: 6 }}
                            >
                                Password
                            </label>
                            <div style={{ position: 'relative' }}>
                                <input
                                    id="password"
                                    type={show ? 'text' : 'password'}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    required
                                    autoFocus
                                    placeholder="Enter admin password"
                                    style={{
                                        height: 36,
                                        width: '100%',
                                        border: '1px solid #CBD5E1',
                                        borderRadius: 8,
                                        paddingLeft: 12,
                                        paddingRight: 40,
                                        fontSize: 14,
                                        color: '#0F172A',
                                        background: '#fff',
                                        outline: 'none',
                                        boxSizing: 'border-box',
                                    }}
                                    onFocus={e => {
                                        e.currentTarget.style.borderColor = '#60A5FA';
                                        e.currentTarget.style.boxShadow = '0 0 0 3px rgba(59,130,246,0.12)';
                                    }}
                                    onBlur={e => {
                                        e.currentTarget.style.borderColor = '#CBD5E1';
                                        e.currentTarget.style.boxShadow = 'none';
                                    }}
                                />
                                <button
                                    type="button"
                                    onClick={() => setShow(s => !s)}
                                    style={{
                                        position: 'absolute',
                                        right: 0, top: 0, bottom: 0,
                                        width: 36,
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        background: 'transparent',
                                        border: 'none',
                                        cursor: 'pointer',
                                        color: '#94A3B8',
                                    }}
                                >
                                    {show ? <EyeOff size={14} /> : <Eye size={14} />}
                                </button>
                            </div>
                        </div>

                        {/* Error */}
                        {error && (
                            <div style={{
                                background: '#FEF2F2',
                                border: '1px solid #FECACA',
                                color: '#B91C1C',
                                fontSize: 13,
                                padding: '8px 12px',
                                borderRadius: 8,
                                display: 'flex',
                                alignItems: 'center',
                                gap: 8,
                            }}>
                                <AlertCircle size={14} />
                                {error}
                            </div>
                        )}

                        {/* Submit */}
                        <button
                            type="submit"
                            disabled={loading}
                            className="btn-press"
                            style={{
                                height: 36,
                                width: '100%',
                                borderRadius: 8,
                                background: loading ? '#475569' : '#0F172A',
                                color: '#fff',
                                fontSize: 14,
                                fontWeight: 500,
                                border: 'none',
                                cursor: loading ? 'not-allowed' : 'pointer',
                                opacity: loading ? 0.7 : 1,
                                transition: 'background 150ms ease',
                            }}
                        >
                            {loading ? 'Signing in…' : 'Sign in'}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
}
