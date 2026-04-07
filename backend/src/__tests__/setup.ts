/**
 * Jest global setup — runs before the test framework is installed in each worker.
 * Sets all required env vars so config.ts doesn't call process.exit(1).
 * Sets NODE_ENV=production to prevent app.listen() from binding a real port.
 */

process.env.NODE_ENV = 'production';
process.env.JWT_SECRET = 'test-jwt-secret-for-jest-do-not-use-in-prod';
process.env.ADMIN_SECRET = 'test-admin-secret';
process.env.UPSTASH_REDIS_REST_URL = 'https://mock-redis.upstash.io';
process.env.UPSTASH_REDIS_REST_TOKEN = 'mock-token';

// Provide a no-op global.fetch for any code that uses it (Redis wrapper, push store)
// Individual tests override this as needed via jest.fn()
global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ result: null }),
    text: async () => '',
}) as any;
