import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';

/**
 * POST /api/workspaces/deductions
 * 
 * Saves the user's manual "Additional Deductions" to the active workspace.
 */
export async function POST(request: Request) {
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const body = await request.json();
        const { workspaceId, additionalDeductions } = body;

        if (!workspaceId) {
            return NextResponse.json({ error: 'Workspace ID is required' }, { status: 400 });
        }

        // Verify the workspace belongs to the user
        const workspace = await prisma.workspace.findUnique({
            where: { id: workspaceId },
        });

        if (!workspace || workspace.userId !== session.user.id) {
            return NextResponse.json({ error: 'Workspace not found or access denied' }, { status: 404 });
        }

        // Build update data
        const updateData: Record<string, unknown> = {};

        // Handle additionalDeductions
        if (additionalDeductions !== undefined) {
            let safeDeductions = null;
            if (Array.isArray(additionalDeductions)) {
                safeDeductions = additionalDeductions.map(d => ({
                    label: String(d.label || '').trim(),
                    amount: String(d.amount || '0').trim()
                })).filter(d => d.label !== '' || d.amount !== '0');
            }
            updateData.additionalDeductions = safeDeductions === null ? undefined : safeDeductions;
        }

        // Handle annualRentAmount (in kobo as a string or number)
        if (body.annualRentAmount !== undefined) {
            const rentKobo = BigInt(body.annualRentAmount || '0');
            updateData.annualRentAmount = rentKobo;
        }

        // Save to database
        await prisma.workspace.update({
            where: { id: workspaceId },
            data: updateData as any,
        });

        return NextResponse.json({ success: true, message: 'Deductions saved successfully' });
    } catch (error) {
        console.error('Error saving additional deductions:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
