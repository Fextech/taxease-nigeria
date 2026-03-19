import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

// Simple middleware: protect everything except public paths
// NextAuth handles its own /api/auth/* routes internally
export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Always allow these paths without any auth check
  const isPublicPath =
    pathname === "/" ||
    pathname === "/sign-in" ||
    pathname === "/sign-up" ||
    pathname === "/mfa-verify" ||
    pathname === "/forgot-password" ||
    pathname === "/reset-password" ||
    pathname === "/privacy" ||
    pathname === "/terms" ||
    pathname.startsWith("/api/") ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    /\.(?:svg|png|jpg|jpeg|gif|webp|ico)$/.test(pathname);

  if (isPublicPath) {
    return NextResponse.next();
  }

  // For all other routes, check the decoded JWT session
  const token = await getToken({
    req,
    secret: process.env.AUTH_SECRET,
    secureCookie: process.env.NODE_ENV === "production" ? true : undefined,
  });

  if (!token) {
    // Redirect to custom sign-in page
    const signInUrl = new URL("/sign-in", req.url);
    signInUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(signInUrl);
  }

  // MFA Gate Check
  if (token.mfaEnabled === true && token.mfaVerified !== true) {
    return NextResponse.redirect(new URL("/mfa-verify", req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all paths except static assets
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
