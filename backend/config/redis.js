/**
 * Redis Client Configuration
 * Provides distributed state management for horizontal scaling
 */

import Redis from 'ioredis';

// Redis connection with automatic reconnection and error handling
const redisConfig = {
    maxRetriesPerRequest: 3,
    retryStrategy: (times) => {
        if (times > 3) {
            console.warn('[Redis] Max retries reached, using in-memory fallback');
            return null; // Stop retrying
        }
        const delay = Math.min(times * 50, 2000);
        return delay;
    },
    reconnectOnError: (err) => {
        const targetError = 'READONLY';
        if (err.message.includes(targetError)) {
            return true;
        }
        return false;
    },
    lazyConnect: true,
    enableReadyCheck: false, // Disable ready check to prevent blocking
    maxLoadingRetryTime: 3000,
    enableOfflineQueue: false, // Don't queue commands when offline
    connectTimeout: 5000
};

let redis;
let redisAvailable = false;

try {
    redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', redisConfig);

    // Connection event handlers
    redis.on('connect', () => {
        console.log('✅ [Redis] Connected successfully');
        redisAvailable = true;
    });

    redis.on('ready', () => {
        console.log('✅ [Redis] Ready to accept commands');
        redisAvailable = true;
    });

    redis.on('error', (err) => {
        console.warn('⚠️  [Redis] Connection error:', err.message);
        console.warn('⚠️  [Redis] Using in-memory fallback');
        redisAvailable = false;
    });

    redis.on('close', () => {
        console.warn('⚠️  [Redis] Connection closed, using in-memory fallback');
        redisAvailable = false;
    });

    redis.on('reconnecting', () => {
        console.log('🔄 [Redis] Reconnecting...');
    });

    // Try to connect (non-blocking)
    redis.connect().catch((err) => {
        console.warn('⚠️  [Redis] Failed to connect:', err.message);
        console.warn('⚠️  [Redis] Running in degraded mode (in-memory fallback)');
        console.warn('💡 [Redis] To enable Redis: Set up Upstash at https://upstash.com or install Redis locally');
        redisAvailable = false;
    });
} catch (err) {
    console.error('❌ [Redis] Failed to create client:', err.message);
    console.warn('⚠️  [Redis] Running in degraded mode (in-memory fallback)');
    redisAvailable = false;
}

// Graceful shutdown
process.on('SIGTERM', async () => {
    if (redis && redisAvailable) {
        console.log('[Redis] Gracefully closing connection...');
        await redis.quit();
    }
});

export default redis;

/**
 * Helper: Check if Redis is available
 */
export async function isRedisAvailable() {
    if (!redis || !redisAvailable) return false;

    try {
        const result = await redis.ping();
        return result === 'PONG';
    } catch (err) {
        return false;
    }
}

/**
 * Helper: Get with JSON parsing
 */
export async function getJSON(key) {
    if (!redisAvailable) return null;

    try {
        const value = await redis.get(key);
        return value ? JSON.parse(value) : null;
    } catch (err) {
        console.error(`[Redis] Error getting ${key}:`, err.message);
        return null;
    }
}

/**
 * Helper: Set with JSON stringification and TTL
 */
export async function setJSON(key, value, ttlSeconds = 3600) {
    if (!redisAvailable) return false;

    try {
        await redis.setex(key, ttlSeconds, JSON.stringify(value));
        return true;
    } catch (err) {
        console.error(`[Redis] Error setting ${key}:`, err.message);
        return false;
    }
}

/**
 * Helper: Delete key
 */
export async function deleteKey(key) {
    if (!redisAvailable) return false;

    try {
        await redis.del(key);
        return true;
    } catch (err) {
        console.error(`[Redis] Error deleting ${key}:`, err.message);
        return false;
    }
}

/**
 * Helper: Get all keys matching pattern
 */
export async function getKeys(pattern) {
    if (!redisAvailable) return [];

    try {
        return await redis.keys(pattern);
    } catch (err) {
        console.error(`[Redis] Error getting keys ${pattern}:`, err.message);
        return [];
    }
}
