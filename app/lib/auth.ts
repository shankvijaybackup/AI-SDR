import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { cookies } from 'next/headers'
import { NextRequest } from 'next/server'

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret-key'
if (process.env.JWT_SECRET) {
  console.log('[Auth] JWT_SECRET loaded from env (Length:', process.env.JWT_SECRET.length, ')')
} else {
  console.warn('[Auth] Using fallback JWT_SECRET!')
}
const TOKEN_NAME = 'auth-token'

export interface JWTPayload {
  userId: string
  email: string
  companyId?: string  // Company the user belongs to
  role?: string       // admin, member
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12)
}

export async function verifyPassword(password: string, hashedPassword: string): Promise<boolean> {
  return bcrypt.compare(password, hashedPassword)
}

export function generateToken(payload: JWTPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' })
}

export function verifyToken(token: string): JWTPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as JWTPayload
  } catch (error) {
    console.error('[Auth] Token verification failed:', error)
    return null
  }
}

export async function setAuthCookie(token: string) {
  const cookieStore = await cookies()
  cookieStore.set(TOKEN_NAME, token, {
    httpOnly: true,
    secure: false, // TODO: Enable when HTTPS is configured
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7, // 7 days
    path: '/',
  })
}

export async function getAuthToken(): Promise<string | null> {
  const cookieStore = await cookies()
  const cookie = cookieStore.get(TOKEN_NAME)
  return cookie?.value || null
}

export async function removeAuthCookie() {
  const cookieStore = await cookies()
  cookieStore.delete(TOKEN_NAME)
}

export async function getCurrentUser(): Promise<JWTPayload | null> {
  const token = await getAuthToken()
  console.log('[Auth] getCurrentUser - Token present:', !!token)
  if (!token) {
    console.log('[Auth] No token found in cookies')
    return null
  }
  const verified = verifyToken(token)
  console.log('[Auth] Token verification:', verified ? 'SUCCESS' : 'FAILED')
  return verified
}

// NEW: Version that works with NextRequest for API routes (production-safe)
export function getCurrentUserFromRequest(request: NextRequest): JWTPayload | null {
  // Try to get token from cookie
  const token = request.cookies.get(TOKEN_NAME)?.value
  console.log('[Auth] getCurrentUserFromRequest - Token present:', !!token)

  if (!token) {
    console.log('[Auth] No token found in request cookies')
    return null
  }

  const verified = verifyToken(token)
  console.log('[Auth] Request token verification:', verified ? 'SUCCESS' : 'FAILED')
  if (!verified) {
    console.error('[Auth] Token verification failed - check JWT_SECRET matches')
  }
  return verified
}
