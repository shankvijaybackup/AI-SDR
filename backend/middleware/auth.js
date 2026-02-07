import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret-key';

/**
 * Authentication middleware
 * Verifies JWT token from cookie or Authorization header
 * Adds user info to req.user
 */
export async function authenticateToken(req, res, next) {
  try {
    // Try to get token from cookie first
    let token = req.cookies?.['auth-token'];

    // If not in cookie, try Authorization header
    if (!token) {
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.substring(7);
      }
    }

    if (!token) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    // Verify token
    const payload = jwt.verify(token, JWT_SECRET);

    // Attach user info to request
    req.user = {
      userId: payload.userId,
      email: payload.email,
      companyId: payload.companyId,
      role: payload.role,
    };

    next();
  } catch (error) {
    console.error('[Auth] Token verification failed:', error.message);
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

/**
 * Require account owner role
 */
export function requireAccountOwner(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  if (req.user.role !== 'account_owner' && req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Only account owners can perform this action' });
  }

  next();
}

/**
 * Require agent or account owner role
 */
export function requireAgentOrOwner(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  if (!['account_owner', 'agent', 'admin', 'member'].includes(req.user.role)) {
    return res.status(403).json({ error: 'Insufficient permissions' });
  }

  next();
}
