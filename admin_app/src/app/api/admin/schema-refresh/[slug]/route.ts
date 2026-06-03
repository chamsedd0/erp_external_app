import { api } from '@/lib/api';
import { requireAdmin } from '@/lib/require-admin';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ slug: string }> }
) {
    const denied = await requireAdmin();
    if (denied) return denied;
    const { slug } = await params;
    try {
        const body = await req.json().catch(() => ({}));
        return NextResponse.json(await api.refreshTenantSchema(slug, body?.model));
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
