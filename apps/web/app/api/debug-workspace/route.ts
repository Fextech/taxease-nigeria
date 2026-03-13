import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/debug-workspace
 * Temporary debug endpoint — remove after testing
 */
export async function GET() {
    try {
        const session = await auth();
        
        const debugInfo: Record<string, unknown> = {
            hasSession: !!session,
            hasUser: !!session?.user,
            userId: session?.user?.id ?? null,
            email: session?.user?.email ?? null,
        };

        if (session?.user?.id) {
            const workspaces = await prisma.workspace.findMany({
                where: { userId: session.user.id },
                orderBy: { taxYear: 'desc' },
            });
            debugInfo.workspaceCount = workspaces.length;
            debugInfo.workspaces = workspaces.map(w => ({
                id: w.id,
                taxYear: w.taxYear,
                status: w.status,
            }));

            // Also check ALL workspaces in DB
            const allWs = await prisma.workspace.findMany({
                include: { user: { select: { id: true, email: true } } },
            });
            debugInfo.allWorkspaces = allWs.map(w => ({
                id: w.id,
                taxYear: w.taxYear,
                userId: w.userId,
                userEmail: w.user.email,
            }));
        }

        return NextResponse.json(debugInfo, { status: 200 });
    } catch (error: unknown) {
        return NextResponse.json({
            error: 'Debug endpoint error',
            message: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined,
        }, { status: 500 });
    }
}
