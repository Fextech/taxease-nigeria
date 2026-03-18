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
                },
            });

            if (!user) {
                return NextResponse.json({ error: 'User not found' }, { status: 404 });
            }

            return NextResponse.json(user);
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

        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    } catch (error) {
        console.error('Settings API error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
