import { api } from '@/lib/api';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ slug: string }> }
) {
    const { slug } = await params;
    const url = new URL(req.url);
    const limit = parseInt(url.searchParams.get('limit') ?? '50', 10);
    const offset = parseInt(url.searchParams.get('offset') ?? '0', 10);
    try {
        const data = await api.getNotifications(slug, limit, offset);
        return NextResponse.json(data);
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
