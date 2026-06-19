import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';

export const { handlers, signIn, signOut, auth } = NextAuth({
    providers: [
        Credentials({
            name: 'Admin Password',
            credentials: {
                password: { label: 'Password', type: 'password' },
            },
            async authorize(credentials) {
                const expectedSecret = process.env.ADMIN_SECRET?.trim();
                const submittedSecret = String(credentials?.password ?? '').trim();
                if (expectedSecret && submittedSecret === expectedSecret) {
                    return { id: 'admin', name: 'Administrator', email: 'admin@shadow-portal.app' };
                }
                return null;
            },
        }),
    ],
    pages: {
        signIn: '/login',
    },
    session: {
        strategy: 'jwt',
        maxAge: 8 * 60 * 60, // 8 hours
    },
    callbacks: {
        // Drives middleware-based protection in NextAuth v5: any matched route
        // is only allowed when there is an active session. Unauthenticated
        // requests are redirected to the signIn page by the middleware.
        authorized: ({ auth }) => !!auth,
    },
});
