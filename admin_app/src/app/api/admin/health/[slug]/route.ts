import { api } from '@/lib/api';
import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/require-admin';

export async function GET(
    _req: NextRequest,
    { params }: { params: Promise<{ slug: string }> }
) {
    const denied = await requireAdmin();
    if (denied) return denied;
    const { slug } = await params;
    try {
        const health = await api.getTenantHealth(slug);
        return NextResponse.json(health);
    } catch (err: any) {
        return NextResponse.json({ ok: false, error: err.message }, { status: 200 });
    }
}
