import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { jwtVerify } from 'jose';

const PUBLIC_FILE = /\.(.*)$/;

export async function middleware(request: NextRequest) {
  const token = request.cookies.get('token')?.value;

  // ignoruj statyczne pliki i api
  if (
    PUBLIC_FILE.test(request.nextUrl.pathname) ||
    request.nextUrl.pathname.startsWith('/api')
  ) {
    return NextResponse.next();
  }

  // jeśli nie ma tokena – redirect
  if (!token) {
    return NextResponse.redirect(new URL('/auth/login', request.url));
  }

  try {
    const { payload } = await jwtVerify(
      token,
      new TextEncoder().encode(process.env.JWT_SECRET!)
    );
  console.log("✅ JWT OK:", payload);

    // możesz tu dodać np. user role → request.headers.set(...)
    return NextResponse.next();
  } catch (err) {
    console.error('Invalid JWT', err);
    return NextResponse.redirect(new URL('/auth/login', request.url));
  }
}

export const config = {
  matcher: ['/dashboard/:path*'],
};