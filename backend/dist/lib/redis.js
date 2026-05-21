"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.redisCommand = redisCommand;
exports.redisGet = redisGet;
exports.redisSet = redisSet;
exports.redisIncr = redisIncr;
exports.redisDel = redisDel;
exports.redisSAdd = redisSAdd;
exports.redisSRem = redisSRem;
exports.redisSMembers = redisSMembers;
exports.redisLPush = redisLPush;
exports.redisLRange = redisLRange;
exports.redisTrim = redisTrim;
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
/** Set a string value by key. Overwrites any existing value. Optional TTL in seconds. */
async function redisSet(key, value, expirySeconds) {
    if (expirySeconds) {
        await redisCommand('SET', key, value, 'EX', expirySeconds);
    }
    else {
        await redisCommand('SET', key, value);
    }
}
/** Increment a numeric key atomically. */
async function redisIncr(key) {
    return redisCommand('INCR', key);
}
/** Delete a key. No-op if the key does not exist. */
async function redisDel(key) {
    await redisCommand('DEL', key);
}
/** Add one or more members to a set. */
async function redisSAdd(key, ...values) {
    return redisCommand('SADD', key, ...values);
}
/** Remove one or more members from a set. */
async function redisSRem(key, ...values) {
    return redisCommand('SREM', key, ...values);
}
/** Return all members of a set. */
async function redisSMembers(key) {
    return redisCommand('SMEMBERS', key);
}
/** Prepend value(s) to a Redis list. Returns new list length. */
async function redisLPush(key, ...values) {
    return redisCommand('LPUSH', key, ...values);
}
/** Return elements from a list between start and stop (inclusive). -1 = last element. */
async function redisLRange(key, start, stop) {
    return redisCommand('LRANGE', key, start, stop);
}
/** Trim list to only contain elements between start and stop (inclusive). */
async function redisTrim(key, start, stop) {
    await redisCommand('LTRIM', key, start, stop);
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
