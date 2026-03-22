import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Admin panel middleware — protects all routes except auth pages.
 * Checks for the server-managed admin auth cookie.
 * RBAC is enforced server-side in tRPC procedures, not here.
 */
export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Public paths that don't require admin auth
  const isPublicPath =
    pathname.startsWith("/login") ||
    pathname.startsWith("/totp-verify") ||
    pathname.startsWith("/setup-totp") ||
    pathname.startsWith("/api/") ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    /\.(?:svg|png|jpg|jpeg|gif|webp|ico)$/.test(pathname);

  if (isPublicPath) {
    return NextResponse.next();
  }

  // Check for admin auth token in cookie
  const adminToken = req.cookies.get("admin_token")?.value;

  if (!adminToken) {
    // No token — redirect to admin login
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Token exists — let the request through.
  // Full JWT validation + RBAC happens in the API layer (tRPC procedures).
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
