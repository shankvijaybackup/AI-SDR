/**
 * Health Check Endpoint
 * Provides system health status for monitoring and load balancers
 */

import redis, { isRedisAvailable } from '../config/redis.js';
import prisma from '../lib/prisma.js';


/**
 * Health check endpoint - returns 200 if all systems operational
 */
export async function healthCheck(req, res) {
    try {
        const checks = {
            redis: await isRedisAvailable(),
            database: false,
            twilio: !!process.env.TWILIO_ACCOUNT_SID && !!process.env.TWILIO_AUTH_TOKEN,
            anthropic: !!process.env.ANTHROPIC_API_KEY,
            groq: !!process.env.GROQ_API_KEY,
            voyage: !!process.env.VOYAGE_API_KEY,
            timestamp: new Date().toISOString()
        };

        // Check database connection
        try {
            await prisma.$queryRaw`SELECT 1`;
            checks.database = true;
        } catch (err) {
            console.error('[Health] Database check failed:', err.message);
        }

        // Determine overall health — Redis is optional (used for caching, not required)
        const healthy = checks.database && checks.twilio && checks.anthropic;
        const status = healthy ? 'healthy' : 'degraded';
        const httpStatus = healthy ? 200 : 503;

        res.status(httpStatus).json({
            status,
            checks,
            version: process.env.npm_package_version || '1.0.0',
            uptime: process.uptime()
        });
    } catch (err) {
        console.error('[Health] Health check error:', err);
        res.status(503).json({
            status: 'unhealthy',
            error: err.message
        });
    }
}

/**
 * Readiness check - returns 200 when ready to accept traffic
 */
export async function readinessCheck(req, res) {
    try {
        // Redis is optional (caching only) — only require database to be ready
        let dbReady = false;
        try {
            await prisma.$queryRaw`SELECT 1`;
            dbReady = true;
        } catch {}

        if (!dbReady) {
            return res.status(503).json({
                ready: false,
                reason: 'Database not available'
            });
        }

        res.json({
            ready: true,
            redis: await isRedisAvailable(),
            timestamp: new Date().toISOString()
        });
    } catch (err) {
        res.status(503).json({
            ready: false,
            error: err.message
        });
    }
}

/**
 * Liveness check - returns 200 if server is running
 */
export function livenessCheck(req, res) {
    res.json({
        alive: true,
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
    });
}
