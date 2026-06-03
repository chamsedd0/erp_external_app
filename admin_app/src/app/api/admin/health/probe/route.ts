import { api } from '@/lib/api';
import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/require-admin';

export async function POST(req: NextRequest) {
    const denied = await requireAdmin();
    if (denied) return denied;
    try {
        const body = await req.json();
        const result = await api.probeOdooHealth(body);
        return NextResponse.json(result);
    } catch (err: any) {
        return NextResponse.json({ ok: false, error: err.message }, { status: 200 });
    }
}
