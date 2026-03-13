import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { z } from "zod";

const resetSchema = z.object({
  token: z.string().min(1),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .regex(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
      "Password must contain at least one uppercase letter, one lowercase letter, and one number"
    ),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const result = resetSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error.errors[0].message },
        { status: 400 }
      );
    }

    const { token, password } = result.data;

    // Find valid token
    const resetToken = await prisma.passwordResetToken.findUnique({
      where: { token },
    });

    if (!resetToken || resetToken.expires < new Date()) {
      // Clean up expired token if it exists
      if (resetToken) {
        await prisma.passwordResetToken.delete({ where: { id: resetToken.id } });
      }
      return NextResponse.json(
        { error: "This reset link has expired. Please request a new one." },
        { status: 400 }
      );
    }

    // Hash and update password
    const hashedPassword = await bcrypt.hash(password, 12);

    await prisma.user.update({
      where: { email: resetToken.email },
      data: { password: hashedPassword },
    });

    // Delete the used token
    await prisma.passwordResetToken.delete({ where: { id: resetToken.id } });

    return NextResponse.json({
      message: "Password has been reset successfully. You can now sign in.",
    });
  } catch {
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 }
    );
  }
}
