import { auth } from './auth';
import { NextResponse } from 'next/server';

/**
 * Defense-in-depth guard for /api/admin/* route handlers.
 *
 * The middleware already gates these routes, but API handlers proxy to the
 * backend with a privileged ADMIN_SECRET, so each one also verifies the
 * session directly. Returns a 401 response when unauthenticated, or null when
 * the caller may proceed.
 */
export async function requireAdmin(): Promise<NextResponse | null> {
    const session = await auth();
    if (!session) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return null;
}
