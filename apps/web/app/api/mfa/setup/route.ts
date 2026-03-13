import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { encrypt } from "@/lib/crypto";
import * as OTPAuth from "otpauth";
import QRCode from "qrcode";

export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { email: true, mfaEnabled: true, totpVerified: true },
  });

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  if (user.mfaEnabled && user.totpVerified) {
    return NextResponse.json(
      { error: "MFA is already enabled. Disable it first to reconfigure." },
      { status: 400 }
    );
  }

  // Generate a new TOTP secret
  const totp = new OTPAuth.TOTP({
    issuer: "TaxEase Nigeria",
    label: user.email,
    algorithm: "SHA1",
    digits: 6,
    period: 30,
    secret: new OTPAuth.Secret({ size: 20 }),
  });

  const otpauthUri = totp.toString();
  const encryptedSecret = encrypt(totp.secret.base32);

  // Store encrypted secret (not yet verified)
  await prisma.user.update({
    where: { id: session.user.id },
    data: {
      totpSecret: encryptedSecret,
      totpVerified: false,
    },
  });

  // Generate QR code as data URL
  const qrCodeDataUrl = await QRCode.toDataURL(otpauthUri);

  return NextResponse.json({
    otpauthUri,
    qrCode: qrCodeDataUrl,
    secret: totp.secret.base32, // Show once for manual entry
  });
}
