import { api } from '@/lib/api';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(
    _req: NextRequest,
    { params }: { params: Promise<{ slug: string }> }
) {
    const { slug } = await params;
    try {
        const devices = await api.getDevices(slug);
        return NextResponse.json(devices);
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
