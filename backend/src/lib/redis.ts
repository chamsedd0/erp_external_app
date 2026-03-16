import { config } from '../config';

/**
 * Thin wrapper around the Upstash Redis REST API.
 * Each call is a single HTTPS request — no persistent connection,
 * making it ideal for Vercel serverless functions.
 */
async function redisCommand<T = any>(...args: (string | number)[]): Promise<T> {
    const response = await fetch(config.upstash.url, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${config.upstash.token}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(args),
    });

    if (!response.ok) {
        const text = await response.text();
        throw new Error(`Redis error ${response.status}: ${text}`);
    }

    const json: { result: T } = await response.json();
    return json.result;
}

/** Get a string value by key. Returns null if the key does not exist. */
export async function redisGet(key: string): Promise<string | null> {
    return redisCommand<string | null>('GET', key);
}

/** Set a string value by key. Overwrites any existing value. */
export async function redisSet(key: string, value: string): Promise<void> {
    await redisCommand('SET', key, value);
}

/** Delete a key. No-op if the key does not exist. */
export async function redisDel(key: string): Promise<void> {
    await redisCommand('DEL', key);
}
