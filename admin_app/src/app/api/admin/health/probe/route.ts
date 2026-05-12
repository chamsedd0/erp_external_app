import { api } from '@/lib/api';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const result = await api.probeOdooHealth(body);
        return NextResponse.json(result);
    } catch (err: any) {
        return NextResponse.json({ ok: false, error: err.message }, { status: 200 });
    }
}
