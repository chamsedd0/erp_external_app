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

export { redisCommand };

/** Get a string value by key. Returns null if the key does not exist. */
export async function redisGet(key: string): Promise<string | null> {
    return redisCommand<string | null>('GET', key);
}

/** Set a string value by key. Overwrites any existing value. Optional TTL in seconds. */
export async function redisSet(key: string, value: string, expirySeconds?: number): Promise<void> {
    if (expirySeconds) {
        await redisCommand('SET', key, value, 'EX', expirySeconds);
    } else {
        await redisCommand('SET', key, value);
    }
}

/** Set a key only when it does not already exist. Returns true when the lock/value was written. */
export async function redisSetNX(key: string, value: string, expirySeconds?: number): Promise<boolean> {
    const result = expirySeconds
        ? await redisCommand<string | null>('SET', key, value, 'NX', 'EX', expirySeconds)
        : await redisCommand<string | null>('SET', key, value, 'NX');
    return result === 'OK';
}

/** Delete a key only when its current value matches the expected value. */
export async function redisDelIfValue(key: string, value: string): Promise<boolean> {
    const script = 'if redis.call("GET", KEYS[1]) == ARGV[1] then return redis.call("DEL", KEYS[1]) else return 0 end';
    const result = await redisCommand<number>('EVAL', script, 1, key, value);
    return result === 1;
}

/** Increment a numeric key atomically. */
export async function redisIncr(key: string): Promise<number> {
    return redisCommand<number>('INCR', key);
}

/** Delete a key. No-op if the key does not exist. */
export async function redisDel(key: string): Promise<void> {
    await redisCommand('DEL', key);
}

/** Add one or more members to a set. */
export async function redisSAdd(key: string, ...values: string[]): Promise<number> {
    return redisCommand<number>('SADD', key, ...values);
}

/** Remove one or more members from a set. */
export async function redisSRem(key: string, ...values: string[]): Promise<number> {
    return redisCommand<number>('SREM', key, ...values);
}

/** Return all members of a set. */
export async function redisSMembers(key: string): Promise<string[]> {
    return redisCommand<string[]>('SMEMBERS', key);
}

/** Prepend value(s) to a Redis list. Returns new list length. */
export async function redisLPush(key: string, ...values: string[]): Promise<number> {
    return redisCommand<number>('LPUSH', key, ...values);
}

/** Return elements from a list between start and stop (inclusive). -1 = last element. */
export async function redisLRange(key: string, start: number, stop: number): Promise<string[]> {
    return redisCommand<string[]>('LRANGE', key, start, stop);
}

/** Trim list to only contain elements between start and stop (inclusive). */
export async function redisTrim(key: string, start: number, stop: number): Promise<void> {
    await redisCommand('LTRIM', key, start, stop);
}

/**
 * Scan for all keys matching a glob pattern.
 * Iterates cursor until complete. Returns all matching keys.
 */
export async function redisScan(pattern: string): Promise<string[]> {
    const keys: string[] = [];
    let cursor = '0';
    do {
        const result = await redisCommand<[string, string[]]>('SCAN', cursor, 'MATCH', pattern, 'COUNT', '100');
        cursor = result[0];
        keys.push(...result[1]);
    } while (cursor !== '0');
    return keys;
}
