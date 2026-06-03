import { NextResponse } from 'next/server';
import { api } from '@/lib/api';
import { requireAdmin } from '@/lib/require-admin';

export async function POST(req: Request, { params }: { params: Promise<{ slug: string }> }) {
    const denied = await requireAdmin();
    if (denied) return denied;
    try {
        const { slug } = await params;
        const body = await req.json();
        const employeeId = Number(body.employee_id);
        if (!Number.isInteger(employeeId) || employeeId <= 0) {
            return NextResponse.json({ error: 'Valid employee_id is required' }, { status: 400 });
        }
        const invite = await api.createInvite(slug, employeeId);
        return NextResponse.json(invite);
    } catch (error: unknown) {
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Failed to create invite' },
            { status: 500 }
        );
    }
}
