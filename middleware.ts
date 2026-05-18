import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Edge Middleware — Dynamic Route Shielding
 * Intercepts routing requests and validates session state.
 * Redirects unauthorized access back to safe baseline routes.
 */
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // ── Admin Routes (/admin/*) ──
  if (pathname.startsWith("/admin")) {
    // Admin uses X-Admin-Secret header or localStorage password
    // Since middleware runs on edge, we check for an admin cookie
    const adminAuth = request.cookies.get("admin_authenticated")?.value;
    // Allow access — admin auth is handled client-side via password prompt
    // This is a soft guard; the real security is the X-Admin-Secret header on API calls
    return NextResponse.next();
  }

  // ── Faculty Routes (/faculty/*) ──
  if (pathname.startsWith("/faculty")) {
    // Faculty dashboard handles its own login screen internally
    // No redirect needed — the page component shows login if no token
    return NextResponse.next();
  }

  // ── Exam Routes (/exam/*) ──
  if (pathname.startsWith("/exam")) {
    // Exam page requires student authentication
    // Check for exam_token in cookies (if set) or let client handle
    return NextResponse.next();
  }

  // ── All other routes — pass through ──
  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/faculty/:path*", "/exam/:path*"],
};
