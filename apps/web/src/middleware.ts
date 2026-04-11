import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const PUBLIC_FILE = /\.(.*)$/;

const hasTokenCookie = (request: NextRequest): boolean => {
  const parsedTokens = request.cookies.getAll('token').filter((entry) => Boolean(entry.value));
  if (parsedTokens.length > 0) return true;

  const rawCookieHeader = request.headers.get('cookie') ?? '';
  if (!rawCookieHeader) return false;

  return rawCookieHeader
    .split(';')
    .map((part) => part.trim())
    .some((part) => part.startsWith('token=') && part.length > 'token='.length);
};

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const normalizedPath =
    pathname !== '/' && pathname.endsWith('/') ? pathname.slice(0, -1) : pathname;

  if (PUBLIC_FILE.test(pathname) || pathname.startsWith('/api')) {
    return NextResponse.next();
  }

  if (!hasTokenCookie(request)) {
    return NextResponse.redirect(new URL('/auth/login', request.url));
  }

  // Legacy dashboard paths removed from IA:
  // keep backward-compatible redirect for old bookmarks.
  if (normalizedPath === '/dashboard/orders' || normalizedPath === '/dashboard/positions') {
    const target = request.nextUrl.clone();
    target.pathname = '/dashboard/bots/runtime';
    target.searchParams.set('legacy', normalizedPath.endsWith('/orders') ? 'orders' : 'positions');
    return NextResponse.redirect(target);
  }

  // Auth token validation is authoritative on API side (/auth/me + requireAuth).
  // Web middleware should stay transport-level only to avoid secret/cookie drift
  // between web and api deployments.
  return NextResponse.next();
}

export const config = {
  matcher: ['/dashboard/:path*', '/admin/:path*'],
};
