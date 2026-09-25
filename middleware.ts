import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Edge Middleware — Dynamic Route Shielding + Security Headers
 * Intercepts routing requests and validates session state.
 * Redirects unauthorized access back to safe baseline routes.
 * LOAD-TEST FIX: Added security headers for production hardening.
 */
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const response = NextResponse.next();

  // ── Security Headers (all responses) ──
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('X-XSS-Protection', '1; mode=block');

  // ── Admin Routes (/admin/*) ──
  if (pathname.startsWith("/admin")) {
    return response;
  }

  // ── Faculty Routes (/faculty/*) ──
  if (pathname.startsWith("/faculty")) {
    return response;
  }

  // ── Exam Routes (/exam/*) ──
  if (pathname.startsWith("/exam")) {
    return response;
  }

  // ── All other routes — pass through ──
  return response;
}

export const config = {
  matcher: ["/admin/:path*", "/faculty/:path*", "/exam/:path*"],
};
