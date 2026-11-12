import { NextRequest, NextResponse } from 'next/server';
import { AUTH_COOKIE_NAME, verifySessionToken } from './lib/auth';

// Public endpoints that never require authentication
const PUBLIC_PATHS = [
  '/login',
  '/api/auth/login',
  '/api/auth/logout',
  '/api/auth/me',
  '/api/health',
];

export async function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;

  // 1. Allow public auth paths
  if (PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    // If user is already authenticated and visits /login, redirect to dashboard
    if (pathname === '/login') {
      const sessionCookie = req.cookies.get(AUTH_COOKIE_NAME)?.value;
      const validSession = await verifySessionToken(sessionCookie);
      if (validSession) {
        return NextResponse.redirect(new URL('/', req.url));
      }
    }
    return NextResponse.next();
  }

  // 2. Allow automated cron or API requests carrying the valid CRON_SECRET
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const authHeader = req.headers.get('authorization');
    const xCronSecret = req.headers.get('x-cron-secret');
    if (
      authHeader === `Bearer ${cronSecret}` ||
      xCronSecret === cronSecret
    ) {
      return NextResponse.next();
    }
  }

  // 3. Check for valid user session cookie
  const sessionCookie = req.cookies.get(AUTH_COOKIE_NAME)?.value;
  const session = await verifySessionToken(sessionCookie);

  // 4. Authenticated request
  if (session) {
    return NextResponse.next();
  }

  // 5. Unauthenticated request
  // For API endpoints, return JSON 401 Unauthorized
  if (pathname.startsWith('/api/')) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized. Sign in to FormGuard Pro to continue.' },
      { status: 401 }
    );
  }

  // For frontend pages, redirect to /login with return destination
  const fromUrl = `${pathname}${search}`;
  const loginUrl = new URL('/login', req.url);
  if (fromUrl && fromUrl !== '/') {
    loginUrl.searchParams.set('from', fromUrl);
  }

  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - image / font extensions
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|woff|woff2)$).*)',
  ],
};

