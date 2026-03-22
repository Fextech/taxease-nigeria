import { NextRequest, NextResponse } from "next/server";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

export async function POST(req: NextRequest) {
  const adminCookie = req.cookies.get("admin_token")?.value;

  if (adminCookie) {
    await fetch(`${API_URL}/trpc/admin.auth.logout`, {
      method: "POST",
      headers: {
        Cookie: `admin_token=${encodeURIComponent(adminCookie)}`,
      },
      cache: "no-store",
    }).catch(() => {
      // Clearing the cookie client-side is still better than leaving it set.
    });
  }

  const response = NextResponse.json({ success: true });
  response.cookies.set({
    name: "admin_token",
    value: "",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return response;
}
