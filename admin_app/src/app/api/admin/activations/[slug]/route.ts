import { NextResponse } from 'next/server';
import { api } from '@/lib/api';
import { requireAdmin } from '@/lib/require-admin';

export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
    const denied = await requireAdmin();
    if (denied) return denied;
    try {
        const { slug } = await params;
        const activations = await api.getActivations(slug);
        return NextResponse.json(activations);
    } catch (error: unknown) {
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Failed to load activations' },
            { status: 500 }
        );
    }
}
