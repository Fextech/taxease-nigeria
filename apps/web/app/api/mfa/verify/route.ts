import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { decrypt } from "@/lib/crypto";
import * as OTPAuth from "otpauth";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { code } = body;

  if (!code || typeof code !== "string") {
    return NextResponse.json(
      { error: "TOTP code is required" },
      { status: 400 }
    );
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { totpSecret: true, email: true },
  });

  if (!user?.totpSecret) {
    return NextResponse.json(
      { error: "MFA setup has not been initiated. Call /api/mfa/setup first." },
      { status: 400 }
    );
  }

  // Decrypt the stored secret
  const secretBase32 = decrypt(user.totpSecret);

  const totp = new OTPAuth.TOTP({
    issuer: "TaxEase Nigeria",
    label: user.email,
    algorithm: "SHA1",
    digits: 6,
    period: 30,
    secret: OTPAuth.Secret.fromBase32(secretBase32),
  });

  // Verify the code (allow 1 window of drift)
  const delta = totp.validate({ token: code, window: 1 });

  if (delta === null) {
    return NextResponse.json(
      { error: "Invalid TOTP code. Please try again." },
      { status: 400 }
    );
  }

  // Mark MFA as enabled and verified
  await prisma.user.update({
    where: { id: session.user.id },
    data: {
      mfaEnabled: true,
      totpVerified: true,
    },
  });

  return NextResponse.json({
    success: true,
    message: "MFA has been successfully enabled.",
  });
}
