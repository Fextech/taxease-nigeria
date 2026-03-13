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
      { error: "TOTP code is required to disable MFA" },
      { status: 400 }
    );
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { totpSecret: true, mfaEnabled: true, email: true },
  });

  if (!user?.mfaEnabled || !user?.totpSecret) {
    return NextResponse.json(
      { error: "MFA is not currently enabled." },
      { status: 400 }
    );
  }

  // Verify the code before disabling
  const secretBase32 = decrypt(user.totpSecret);

  const totp = new OTPAuth.TOTP({
    issuer: "TaxEase Nigeria",
    label: user.email,
    algorithm: "SHA1",
    digits: 6,
    period: 30,
    secret: OTPAuth.Secret.fromBase32(secretBase32),
  });

  const delta = totp.validate({ token: code, window: 1 });

  if (delta === null) {
    return NextResponse.json(
      { error: "Invalid TOTP code. MFA was not disabled." },
      { status: 400 }
    );
  }

  // Disable MFA
  await prisma.user.update({
    where: { id: session.user.id },
    data: {
      mfaEnabled: false,
      totpSecret: null,
      totpVerified: false,
    },
  });

  return NextResponse.json({
    success: true,
    message: "MFA has been disabled.",
  });
}
