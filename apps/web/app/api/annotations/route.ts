import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';

/**
 * POST /api/annotations
 *
 * Proxy for annotation actions:
 * - action: "list"       → Fetches transactions with annotations for a workspace
 * - action: "stats"      → Calculates real-time tax stats
 * - action: "upsert"     → Creates or updates a single annotation
 * - action: "bulkUpsert" → Batch categorise multiple transactions
 */
export async function POST(request: Request) {
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { action, ...data } = body;

    try {
        // ─── LIST ────────────────────────────────────────
        if (action === 'list') {
            const workspace = await prisma.workspace.findUnique({
                where: { id: data.workspaceId },
            });

            if (!workspace || workspace.userId !== session.user.id) {
                return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
            }

            const whereClause: Record<string, unknown> = {
                statement: { workspaceId: data.workspaceId },
            };
            if (data.month) {
                whereClause.statement = { workspaceId: data.workspaceId, month: data.month };
            }

            const transactions = await prisma.transaction.findMany({
                where: whereClause,
                orderBy: { transactionDate: 'desc' },
                select: {
                    id: true,
                    transactionDate: true,
                    description: true,
                    creditAmount: true,
                    debitAmount: true,
                    balance: true,
                    channel: true,
                    confidence: true,
                    statement: { select: { month: true, bankName: true } },
                    annotation: {
                        select: {
                            id: true,
                            taxableStatus: true,
                            taxableAmount: true,
                            taxCategory: true,
                            reason: true,
                            reliefType: true,
                            status: true,
                            notes: true,
                            aiSuggested: true,
                            aiConfidence: true,
                        },
                    },
                },
            });

            // Serialize BigInt values
            const serialized = transactions.map((tx) => ({
                ...tx,
                creditAmount: tx.creditAmount.toString(),
                debitAmount: tx.debitAmount.toString(),
                balance: tx.balance?.toString() ?? null,
                annotation: tx.annotation
                    ? {
                          ...tx.annotation,
                          taxableAmount: tx.annotation.taxableAmount?.toString() ?? null,
                      }
                    : null,
            }));

            return NextResponse.json(serialized);
        }

        // ─── STATS ───────────────────────────────────────
        if (action === 'stats') {
            const workspace = await prisma.workspace.findUnique({
                where: { id: data.workspaceId },
            });

            if (!workspace || workspace.userId !== session.user.id) {
                return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
            }

            const totalCount = await prisma.transaction.count({
                where: { statement: { workspaceId: data.workspaceId } },
            });

            const annotatedCount = await prisma.annotation.count({
                where: {
                    status: 'COMPLETE',
                    transaction: { statement: { workspaceId: data.workspaceId } },
                },
            });

            // ── Taxable credit annotations (YES / PARTIAL on credits) ──
            const taxableAnnotations = await prisma.annotation.findMany({
                where: {
                    status: 'COMPLETE',
                    taxableStatus: { in: ['YES', 'PARTIAL'] },
                    transaction: {
                        statement: { workspaceId: data.workspaceId },
                        creditAmount: { gt: 0 },     // only credit rows
                    },
                },
                select: {
                    taxableStatus: true,
                    taxableAmount: true,
                    transaction: { select: { creditAmount: true } },
                },
            });

            let totalTaxableKobo = BigInt(0);
            for (const ann of taxableAnnotations) {
                if (ann.taxableStatus === 'PARTIAL' && ann.taxableAmount != null) {
                    totalTaxableKobo += ann.taxableAmount;
                } else if (ann.taxableStatus === 'YES') {
                    totalTaxableKobo += ann.transaction.creditAmount;
                }
            }

            // ── Direct Business Expense deductions (YES on debits) ──
            const dbeAnnotations = await prisma.annotation.findMany({
                where: {
                    status: 'COMPLETE',
                    taxableStatus: 'YES',            // DBE mapped to YES
                    transaction: {
                        statement: { workspaceId: data.workspaceId },
                        debitAmount: { gt: 0 },       // only debit rows
                    },
                },
                select: {
                    transaction: { select: { debitAmount: true } },
                },
            });

            let totalDBEKobo = BigInt(0);
            for (const ann of dbeAnnotations) {
                totalDBEKobo += ann.transaction.debitAmount;
            }

            // Subtract DBE from total taxable (floor at 0)
            const netTaxable = totalTaxableKobo > totalDBEKobo
                ? totalTaxableKobo - totalDBEKobo
                : BigInt(0);

            return NextResponse.json({
                totalTransactions: totalCount,
                annotatedTransactions: annotatedCount,
                pendingReview: totalCount - annotatedCount,
                totalTaxableKobo: netTaxable.toString(),
                totalDBEKobo: totalDBEKobo.toString(),
            });
        }

        // ─── UPSERT ─────────────────────────────────────
        if (action === 'upsert') {
            const transaction = await prisma.transaction.findUnique({
                where: { id: data.transactionId },
                include: {
                    statement: { select: { workspace: { select: { userId: true, status: true } } } },
                },
            });

            if (!transaction || transaction.statement.workspace.userId !== session.user.id) {
                return NextResponse.json({ error: 'Transaction not found' }, { status: 404 });
            }

            if (transaction.statement.workspace.status === 'LOCKED') {
                return NextResponse.json({ error: 'Workspace is locked' }, { status: 403 });
            }

            if (data.taxableStatus === 'PARTIAL' && !data.taxableAmount) {
                return NextResponse.json(
                    { error: 'Taxable amount is required for PARTIAL status' },
                    { status: 400 }
                );
            }

            const annotation = await prisma.annotation.upsert({
                where: { transactionId: data.transactionId },
                create: {
                    transactionId: data.transactionId,
                    taxableStatus: data.taxableStatus,
                    taxableAmount: data.taxableAmount ? BigInt(data.taxableAmount) : null,
                    taxCategory: data.taxCategory || 'UNCLASSIFIED',
                    reason: data.reason || null,
                    reliefType: data.reliefType || null,
                    notes: data.notes || null,
                    status: data.status || 'COMPLETE',
                    annotatedBy: session.user.id,
                },
                update: {
                    taxableStatus: data.taxableStatus,
                    taxableAmount: data.taxableAmount ? BigInt(data.taxableAmount) : null,
                    taxCategory: data.taxCategory || 'UNCLASSIFIED',
                    reason: data.reason || null,
                    reliefType: data.reliefType || null,
                    notes: data.notes || null,
                    status: data.status || 'COMPLETE',
                    annotatedBy: session.user.id,
                },
            });

            return NextResponse.json({
                ...annotation,
                taxableAmount: annotation.taxableAmount?.toString() ?? null,
                computedLiability: annotation.computedLiability.toString(),
            });
        }

        // ─── BULK UPSERT ────────────────────────────────
        if (action === 'bulkUpsert') {
            const transactions = await prisma.transaction.findMany({
                where: {
                    id: { in: data.transactionIds },
                    statement: { workspace: { userId: session.user.id } },
                },
                select: { id: true },
            });

            if (transactions.length !== data.transactionIds.length) {
                return NextResponse.json(
                    { error: 'Some transactions not found' },
                    { status: 400 }
                );
            }

            const results = await prisma.$transaction(
                data.transactionIds.map((txId: string) =>
                    prisma.annotation.upsert({
                        where: { transactionId: txId },
                        create: {
                            transactionId: txId,
                            taxableStatus: data.taxableStatus,
                            taxCategory: data.taxCategory || 'UNCLASSIFIED',
                            reason: data.reason || null,
                            status: 'COMPLETE',
                            annotatedBy: session.user!.id,
                        },
                        update: {
                            taxableStatus: data.taxableStatus,
                            taxCategory: data.taxCategory || 'UNCLASSIFIED',
                            reason: data.reason || null,
                            status: 'COMPLETE',
                            annotatedBy: session.user!.id,
                        },
                    })
                )
            );

            return NextResponse.json({ updated: results.length });
        }

        // ─── DELETE BY MONTH ────────────────────────────
        if (action === 'deleteByMonth') {
            const workspace = await prisma.workspace.findUnique({
                where: { id: data.workspaceId },
            });

            if (!workspace || workspace.userId !== session.user.id) {
                return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
            }

            // Find the statement for this month
            const statement = await prisma.statement.findFirst({
                where: {
                    workspaceId: data.workspaceId,
                    month: data.month,
                },
            });

            if (!statement) {
                return NextResponse.json({ error: 'No statement found for this month' }, { status: 404 });
            }

            // Soft-delete annotations → transactions for this statement
            await (prisma.annotation as unknown as { softDeleteMany: (args: { where: unknown }) => Promise<unknown> }).softDeleteMany({
                where: { transaction: { statementId: statement.id } },
            });
            await (prisma.transaction as unknown as { softDeleteMany: (args: { where: unknown }) => Promise<unknown> }).softDeleteMany({
                where: { statementId: statement.id },
            });

            return NextResponse.json({ success: true, month: data.month });
        }

        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    } catch (error) {
        console.error('Annotations API error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
