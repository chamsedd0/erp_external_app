import AsyncStorage from '@react-native-async-storage/async-storage';

// Default TTL: 24 hours in milliseconds
const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000;

interface CacheEntry<T> {
    data: T[];
    expiresAt: number; // Unix timestamp (ms)
}

/**
 * Read cached data for a given key.
 * Returns null if the key doesn't exist or the cache has expired.
 */
export async function getCached<T>(key: string): Promise<T[] | null> {
    try {
        const raw = await AsyncStorage.getItem(`cache_${key}`);
        if (!raw) return null;

        const entry: CacheEntry<T> = JSON.parse(raw);

        if (Date.now() > entry.expiresAt) {
            // Expired — delete and return null
            await AsyncStorage.removeItem(`cache_${key}`);
            return null;
        }

        return entry.data;
    } catch {
        return null;
    }
}

/**
 * Write data to the cache with a 24-hour TTL.
 */
export async function setCached<T>(key: string, data: T[], ttlMs: number = DEFAULT_TTL_MS): Promise<void> {
    try {
        const entry: CacheEntry<T> = {
            data,
            expiresAt: Date.now() + ttlMs,
        };
        await AsyncStorage.setItem(`cache_${key}`, JSON.stringify(entry));
    } catch {
        // Cache write failure is non-critical — ignore silently
    }
}

/**
 * Remove a single cached entry by key.
 */
export async function clearCacheKey(key: string): Promise<void> {
    try {
        await AsyncStorage.removeItem(`cache_${key}`);
    } catch {}
}

/**
 * Clear all app cache entries (keys prefixed with 'cache_').
 * Call this on logout or when forcing a full refresh.
 */
export async function clearAllCache(): Promise<void> {
    try {
        const allKeys = await AsyncStorage.getAllKeys();
        const cacheKeys = allKeys.filter(k => k.startsWith('cache_'));
        if (cacheKeys.length > 0) {
            await AsyncStorage.multiRemove(cacheKeys);
        }
    } catch {}
}
