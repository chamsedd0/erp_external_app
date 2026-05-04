'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Shield } from 'lucide-react';

export default function LoginPage() {
    const [password, setPassword] = useState('');
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
        <div className="flex min-h-full items-center justify-center">
            <div className="w-full max-w-sm px-4">
                <div className="text-center mb-8">
                    <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-900 mb-4">
                        <Shield size={26} className="text-white" />
                    </div>
                    <h1 className="text-2xl font-bold text-slate-900">Shadow Portal</h1>
                    <p className="text-sm text-slate-500 mt-1">Admin Dashboard</p>
                </div>

                <form
                    onSubmit={handleSubmit}
                    className="bg-white shadow-sm rounded-xl border border-slate-200 p-8 space-y-5"
                >
                    <div>
                        <label
                            htmlFor="password"
                            className="block text-sm font-medium text-slate-700 mb-1.5"
                        >
                            Admin Password
                        </label>
                        <input
                            id="password"
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                            autoFocus
                            placeholder="Enter admin password"
                            className="flex h-9 w-full rounded-lg border border-slate-300 bg-white px-3 py-1 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:border-transparent"
                        />
                    </div>

                    {error && (
                        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                            {error}
                        </p>
                    )}

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full h-9 rounded-lg bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {loading ? 'Signing in…' : 'Sign in'}
                    </button>
                </form>
            </div>
        </div>
    );
}
