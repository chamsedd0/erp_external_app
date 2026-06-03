import { api } from '@/lib/api';
import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/require-admin';

export async function POST(
    _req: NextRequest,
    { params }: { params: Promise<{ slug: string }> }
) {
    const denied = await requireAdmin();
    if (denied) return denied;
    const { slug } = await params;
    try {
        const result = await api.sendQuotation(slug);
        return NextResponse.json(result);
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
