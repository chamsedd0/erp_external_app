export { auth as middleware } from '@/lib/auth';

export const config = {
    matcher: ['/((?!login|_next/static|_next/image|favicon.ico).*)'],
};
