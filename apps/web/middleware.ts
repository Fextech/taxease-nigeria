import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

const MAINTENANCE_GATED_PATHS = new Set([
  "/sign-up",
]);

async function isMaintenanceModeEnabled(req: NextRequest) {
  try {
    const res = await fetch(new URL("/api/maintenance", req.url), {
      cache: "no-store",
      headers: {
        "x-middleware-subrequest": "maintenance-check",
      },
    });

    if (!res.ok) return false;
    const data = await res.json();
    return data.enabled === true;
  } catch {
    return false;
  }
}

// Simple middleware: protect everything except public paths
// NextAuth handles its own /api/auth/* routes internally
export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (
    pathname !== "/maintenance" &&
    MAINTENANCE_GATED_PATHS.has(pathname) &&
    (await isMaintenanceModeEnabled(req))
  ) {
    return NextResponse.redirect(new URL("/maintenance", req.url));
  }

  // Always allow these paths without any auth check
  const isPublicPath =
    pathname === "/" ||
    pathname === "/sign-in" ||
    pathname === "/sign-up" ||
    pathname === "/mfa-verify" ||
    pathname === "/forgot-password" ||
    pathname === "/reset-password" ||
    pathname === "/maintenance" ||
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

  if ((token as { invalid?: boolean }).invalid === true) {
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
