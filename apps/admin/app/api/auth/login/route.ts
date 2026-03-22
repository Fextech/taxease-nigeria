import { NextRequest, NextResponse } from "next/server";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const res = await fetch(`${API_URL}/trpc/admin.auth.login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
    });

    const data = await res.json().catch(() => null);
    if (!res.ok) {
      return NextResponse.json(
        { error: data?.error?.message || "Invalid credentials" },
        { status: res.status }
      );
    }

    return NextResponse.json({
      requiresTotp: data?.result?.data?.requiresTotp ?? false,
      adminId: data?.result?.data?.adminId ?? null,
      admin: data?.result?.data?.admin ?? null,
    });
  } catch {
    return NextResponse.json(
      { error: "Login failed" },
      { status: 500 }
    );
  }
}
