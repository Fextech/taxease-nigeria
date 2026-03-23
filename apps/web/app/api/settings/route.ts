import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import bcrypt from "bcryptjs";

/**
 * POST /api/settings
 *
 * Proxy for settings actions:
 * - action: "get"    → Fetches user settings
 * - action: "update" → Updates user settings
 */
export async function POST(request: Request) {
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { action, ...data } = body;

    try {
        if (action === 'get') {
            const user = await prisma.user.findUnique({
                where: { id: session.user.id },
                select: {
                    name: true,
                    email: true,
                    phone: true,
                    taxIdentificationNumber: true,
                    professionalCategory: true,
                    stateOfResidence: true,
                    plan: true,
                    mfaEnabled: true,
                    password: true,
                    accounts: {
                        where: { provider: 'google' },
                        select: { id: true },
                    },
                },
            });

            if (!user) {
                return NextResponse.json({ error: 'User not found' }, { status: 404 });
            }

            return NextResponse.json({
                name: user.name,
                email: user.email,
                phone: user.phone,
                taxIdentificationNumber: user.taxIdentificationNumber,
                professionalCategory: user.professionalCategory,
                stateOfResidence: user.stateOfResidence,
                plan: user.plan,
                mfaEnabled: user.mfaEnabled,
                hasPassword: Boolean(user.password),
                hasGoogleAccount: user.accounts.length > 0,
            });
        }

        if (action === 'update') {
            const updateData: Record<string, string | null> = {};

            if (data.name !== undefined) updateData.name = data.name;
            if (data.phone !== undefined) updateData.phone = data.phone;
            if (data.taxIdentificationNumber !== undefined) updateData.taxIdentificationNumber = data.taxIdentificationNumber;
            if (data.professionalCategory !== undefined) updateData.professionalCategory = data.professionalCategory;
            if (data.stateOfResidence !== undefined) updateData.stateOfResidence = data.stateOfResidence;

            const user = await prisma.user.update({
                where: { id: session.user.id },
                data: updateData,
                select: {
                    name: true,
                    email: true,
                    phone: true,
                    taxIdentificationNumber: true,
                    professionalCategory: true,
                    stateOfResidence: true,
                    plan: true,
                    mfaEnabled: true,
                },
            });

            return NextResponse.json(user);
        }

        if (action === 'change_password') {
            const { currentPassword, newPassword } = data;
            if (!currentPassword || !newPassword) {
                return NextResponse.json({ error: "Current and new password are required" }, { status: 400 });
            }

            const user = await prisma.user.findUnique({ where: { id: session.user.id } });
            if (!user || !user.password) {
                return NextResponse.json({ error: "User not found or no password set. Please use password reset." }, { status: 400 });
            }

            const isValid = await bcrypt.compare(currentPassword, user.password);
            if (!isValid) {
                return NextResponse.json({ error: "Incorrect current password" }, { status: 400 });
            }

            const hashedPassword = await bcrypt.hash(newPassword, 12);
            await prisma.user.update({
                where: { id: session.user.id },
                data: { password: hashedPassword },
            });

            return NextResponse.json({ success: true, message: "Password updated successfully" });
        }

        if (action === 'set_password') {
            const { newPassword } = data;
            if (!newPassword) {
                return NextResponse.json({ error: "New password is required" }, { status: 400 });
            }

            if (
                typeof newPassword !== "string" ||
                newPassword.length < 8 ||
                !/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(newPassword)
            ) {
                return NextResponse.json({
                    error: "Password must be at least 8 characters and include uppercase, lowercase, and a number",
                }, { status: 400 });
            }

            const user = await prisma.user.findUnique({ where: { id: session.user.id } });
            if (!user) {
                return NextResponse.json({ error: "User not found" }, { status: 404 });
            }

            if (user.password) {
                return NextResponse.json({ error: "Password already set. Please use change password instead." }, { status: 400 });
            }

            const hashedPassword = await bcrypt.hash(newPassword, 12);
            await prisma.user.update({
                where: { id: session.user.id },
                data: { password: hashedPassword },
            });

            return NextResponse.json({ success: true, message: "Password setup completed successfully" });
        }

        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    } catch (error) {
        console.error('Settings API error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
