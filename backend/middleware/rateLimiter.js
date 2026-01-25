/**
 * Rate Limiting Middleware
 * Protects API from abuse and ensures fair usage
 */

import rateLimit from 'express-rate-limit';
import RedisStore from 'rate-limit-redis';
import redis, { isRedisAvailable } from '../config/redis.js';

// Check if rate limiting is enabled
const ENABLE_RATE_LIMITING = process.env.ENABLE_RATE_LIMITING === 'true' || process.env.NODE_ENV === 'production';

/**
 * Create Redis store safely with fallback to memory store
 */
function createStore(prefix) {
    try {
        // Only use Redis if connection is available
        if (redis && redis.status === 'ready') {
            return new RedisStore({
                sendCommand: (...args) => redis.call(...args),
                prefix
            });
        }
    } catch (err) {
        console.warn(`[RateLimit] Failed to create Redis store: ${err.message}`);
    }

    // Fallback to memory store (express-rate-limit default)
    console.log(`[RateLimit] Using in-memory store for ${prefix}`);
    return undefined;
}

/**
 * Global API rate limiter
 * 100 requests per minute per IP/user
 */
export const apiLimiter = rateLimit({
    store: createStore('rl:api:'),
    windowMs: 60 * 1000, // 1 minute
    max: 100, // 100 requests per minute
    standardHeaders: true, // Return rate limit info in headers
    legacyHeaders: false,
    skip: () => !ENABLE_RATE_LIMITING, // Skip if disabled
    keyGenerator: (req) => {
        // Use user ID if authenticated, otherwise IP
        return req.user?.id || req.ip;
    },
    handler: (req, res) => {
        console.warn(`[RateLimit] API limit exceeded for ${req.user?.id || req.ip}`);
        res.status(429).json({
            error: 'Too many requests',
            message: 'Please slow down. Maximum 100 requests per minute.',
            retryAfter: 60
        });
    }
});

/**
 * Strict rate limiter for expensive operations (calls, enrichment)
 * 10 requests per minute per user
 */
export const strictLimiter = rateLimit({
    store: createStore('rl:strict:'),
    windowMs: 60 * 1000,
    max: 10, // 10 requests per minute
    standardHeaders: true,
    legacyHeaders: false,
    skip: () => !ENABLE_RATE_LIMITING,
    keyGenerator: (req) => req.user?.id || req.ip,
    handler: (req, res) => {
        console.warn(`[RateLimit] Strict limit exceeded for ${req.user?.id || req.ip}`);
        res.status(429).json({
            error: 'Too many requests',
            message: 'Maximum 10 calls per minute. Please wait before trying again.',
            retryAfter: 60
        });
    }
});

/**
 * Lenient rate limiter for read operations
 * 200 requests per minute per user
 */
export const readLimiter = rateLimit({
    store: createStore('rl:read:'),
    windowMs: 60 * 1000,
    max: 200,
    standardHeaders: true,
    legacyHeaders: false,
    skip: () => !ENABLE_RATE_LIMITING,
    keyGenerator: (req) => req.user?.id || req.ip
});

console.log(`[RateLimit] Rate limiting ${ENABLE_RATE_LIMITING ? 'ENABLED' : 'DISABLED'}`);
