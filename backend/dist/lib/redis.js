"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.redisGet = redisGet;
exports.redisSet = redisSet;
exports.redisDel = redisDel;
exports.redisScan = redisScan;
const config_1 = require("../config");
/**
 * Thin wrapper around the Upstash Redis REST API.
 * Each call is a single HTTPS request — no persistent connection,
 * making it ideal for Vercel serverless functions.
 */
async function redisCommand(...args) {
    const response = await fetch(config_1.config.upstash.url, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${config_1.config.upstash.token}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(args),
    });
    if (!response.ok) {
        const text = await response.text();
        throw new Error(`Redis error ${response.status}: ${text}`);
    }
    const json = await response.json();
    return json.result;
}
/** Get a string value by key. Returns null if the key does not exist. */
async function redisGet(key) {
    return redisCommand('GET', key);
}
/** Set a string value by key. Overwrites any existing value. */
async function redisSet(key, value) {
    await redisCommand('SET', key, value);
}
/** Delete a key. No-op if the key does not exist. */
async function redisDel(key) {
    await redisCommand('DEL', key);
}
/**
 * Scan for all keys matching a glob pattern.
 * Iterates cursor until complete. Returns all matching keys.
 */
async function redisScan(pattern) {
    const keys = [];
    let cursor = '0';
    do {
        const result = await redisCommand('SCAN', cursor, 'MATCH', pattern, 'COUNT', '100');
        cursor = result[0];
        keys.push(...result[1]);
    } while (cursor !== '0');
    return keys;
}
