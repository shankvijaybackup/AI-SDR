import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  const token = request.cookies.get('auth-token')?.value
  const { pathname } = request.nextUrl

  console.log('[Middleware] Path:', pathname, 'Token exists:', !!token)

  // Public routes
  const publicRoutes = ['/login', '/register']
  const isPublicRoute = publicRoutes.some(route => pathname.startsWith(route))

  // Protected routes
  const protectedRoutes = ['/leads', '/scripts', '/calling', '/follow-ups', '/settings']
  const isProtectedRoute = protectedRoutes.some(route => pathname.startsWith(route))

  // If accessing public route with token, redirect to leads
  if (isPublicRoute && token) {
    console.log('[Middleware] Redirecting from public route to leads')
    return NextResponse.redirect(new URL('/leads', request.url))
  }

  // If accessing protected route without token, redirect to login
  if (isProtectedRoute && !token) {
    console.log('[Middleware] No token, redirecting to login')
    return NextResponse.redirect(new URL('/login', request.url))
  }

  console.log('[Middleware] Allowing request to proceed')
  return NextResponse.next()
}

export const config = {
  matcher: ['/leads/:path*', '/scripts/:path*', '/calling/:path*', '/follow-ups/:path*', '/settings/:path*', '/login', '/register']
}
