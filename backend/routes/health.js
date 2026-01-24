/**
 * Health Check Endpoint
 * Provides system health status for monitoring and load balancers
 */

import redis, { isRedisAvailable } from '../config/redis.js';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Health check endpoint - returns 200 if all systems operational
 */
export async function healthCheck(req, res) {
    try {
        const checks = {
            redis: await isRedisAvailable(),
            database: false,
            twilio: !!process.env.TWILIO_ACCOUNT_SID && !!process.env.TWILIO_AUTH_TOKEN,
            openai: !!process.env.OPENAI_API_KEY,
            timestamp: new Date().toISOString()
        };

        // Check database connection
        try {
            await prisma.$queryRaw`SELECT 1`;
            checks.database = true;
        } catch (err) {
            console.error('[Health] Database check failed:', err.message);
        }

        // Determine overall health
        const healthy = checks.redis && checks.database && checks.twilio && checks.openai;
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
        // Check if Redis is available (required for distributed state)
        const redisReady = await isRedisAvailable();

        if (!redisReady) {
            return res.status(503).json({
                ready: false,
                reason: 'Redis not available'
            });
        }

        res.json({
            ready: true,
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
