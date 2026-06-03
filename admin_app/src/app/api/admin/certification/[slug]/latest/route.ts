import { api } from '@/lib/api';
import { requireAdmin } from '@/lib/require-admin';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(
    _req: NextRequest,
    { params }: { params: Promise<{ slug: string }> }
) {
    const denied = await requireAdmin();
    if (denied) return denied;
    const { slug } = await params;
    try {
        return NextResponse.json(await api.getLatestCertification(slug));
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
