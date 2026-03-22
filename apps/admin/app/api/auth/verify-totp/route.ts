import { NextRequest, NextResponse } from "next/server";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
const SESSION_MAX_AGE_SECONDS = 12 * 60 * 60;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const res = await fetch(`${API_URL}/trpc/admin.auth.verifyTotp`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
    });

    const data = await res.json().catch(() => null);
    if (!res.ok) {
      return NextResponse.json(
        { error: data?.error?.message || "Invalid TOTP code" },
        { status: res.status }
      );
    }

    const token = data?.result?.data?.token;
    const admin = data?.result?.data?.admin ?? null;

    if (!token) {
      return NextResponse.json(
        { error: "Missing admin session token" },
        { status: 500 }
      );
    }

    const response = NextResponse.json({ admin });
    response.cookies.set({
      name: "admin_token",
      value: token,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: SESSION_MAX_AGE_SECONDS,
    });

    return response;
  } catch {
    return NextResponse.json(
      { error: "Verification failed" },
      { status: 500 }
    );
  }
}
