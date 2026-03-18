import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';

/**
 * POST /api/workspace
 *
 * Proxy for workspace actions:
 * - action: "list"   → List all workspaces for the current user
 * - action: "create" → Create a new workspace for a tax year
 */
export async function POST(request: Request) {
    const session = await auth();

    if (!session?.user?.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { action, ...data } = body;

    try {
        if (action === 'list') {
            const workspaces = await prisma.workspace.findMany({
                where: { userId: session.user.id },
                orderBy: { taxYear: 'desc' },
                select: { id: true, taxYear: true, status: true, isUnlocked: true, statementCredits: true, allowedBanksCount: true, additionalDeductions: true, annualRentAmount: true },
            });
            const serializedWorkspaces = workspaces.map(w => ({
                ...w,
                annualRentAmount: w.annualRentAmount ? w.annualRentAmount.toString() : null,
            }));
            return NextResponse.json(serializedWorkspaces);
        }

        if (action === 'create') {
            const existing = await prisma.workspace.findUnique({
                where: {
                    userId_taxYear: {
                        userId: session.user.id,
                        taxYear: data.taxYear,
                    },
                },
            });

            if (existing) {
                return NextResponse.json(
                    { error: `Workspace for tax year ${data.taxYear} already exists.` },
                    { status: 409 }
                );
            }

            const workspace = await prisma.workspace.create({
                data: {
                    userId: session.user.id,
                    taxYear: data.taxYear,
                },
                select: { id: true, taxYear: true, status: true, isUnlocked: true, statementCredits: true, allowedBanksCount: true, additionalDeductions: true, annualRentAmount: true },
            });

            const serializedWorkspace = {
                ...workspace,
                annualRentAmount: workspace.annualRentAmount ? workspace.annualRentAmount.toString() : null,
            };
            return NextResponse.json(serializedWorkspace);
        }

        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    } catch (error: unknown) {
        // Handle foreign key constraint violation (user no longer exists after DB reset)
        if (error && typeof error === 'object' && 'code' in error && error.code === 'P2003') {
            console.error('Workspace API: User not found in database. Session may be stale after DB reset.');
            return NextResponse.json(
                { error: 'Your session is stale. Please sign out and sign back in.' },
                { status: 401 }
            );
        }
        const message = error instanceof Error ? error.message : String(error);
        console.error('Workspace API error:', message, error);
        return NextResponse.json({ error: 'Internal server error', detail: message }, { status: 500 });
    }
}
