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
            const page = Math.max(1, Number(data.page) || 1);
            const pageSize = Math.min(200, Math.max(1, Number(data.pageSize) || 50));

            const workspace = await prisma.workspace.findUnique({
                where: { id: data.workspaceId },
            });

            if (!workspace || workspace.userId !== session.user.id) {
                return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
            }

            const whereClause: Record<string, unknown> = {
                statement: { workspaceId: data.workspaceId },
                deletedAt: null,
            };
            if (data.month) {
                whereClause.statement = { workspaceId: data.workspaceId, month: data.month };
            }

            const transactions = await prisma.transaction.findMany({
                where: whereClause,
                orderBy: [
                    { transactionDate: 'desc' },
                    { id: 'desc' },
                ],
                skip: (page - 1) * pageSize,
                take: pageSize,
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

            return NextResponse.json({
                items: serialized,
                page,
                pageSize,
            });
        }

        // ─── STATS ───────────────────────────────────────
        if (action === 'stats') {
            const workspace = await prisma.workspace.findUnique({
                where: { id: data.workspaceId },
            });

            if (!workspace || workspace.userId !== session.user.id) {
                return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
            }

            const [
                totalCount,
                annotatedCount,
                totalIncomeAggregate,
                totalDBEAggregate,
                groupedTransactions,
            ] = await Promise.all([
                prisma.transaction.count({
                    where: {
                        statement: { workspaceId: data.workspaceId, deletedAt: null },
                        deletedAt: null,
                    },
                }),
                prisma.annotation.count({
                    where: {
                        status: 'COMPLETE',
                        transaction: { statement: { workspaceId: data.workspaceId, deletedAt: null }, deletedAt: null },
                        deletedAt: null,
                    },
                }),
                prisma.transaction.aggregate({
                    where: {
                        statement: { workspaceId: data.workspaceId, deletedAt: null },
                        deletedAt: null,
                        creditAmount: { gt: 0 },
                        annotation: {
                            is: {
                                status: 'COMPLETE',
                                taxableStatus: 'YES',
                                deletedAt: null,
                            },
                        },
                    },
                    _sum: { creditAmount: true },
                }),
                prisma.transaction.aggregate({
                    where: {
                        statement: { workspaceId: data.workspaceId, deletedAt: null },
                        deletedAt: null,
                        debitAmount: { gt: 0 },
                        annotation: {
                            is: {
                                status: 'COMPLETE',
                                taxableStatus: 'YES',
                                deletedAt: null,
                            },
                        },
                    },
                    _sum: { debitAmount: true },
                }),
                prisma.transaction.groupBy({
                    by: ['statementId'],
                    where: {
                        statement: { workspaceId: data.workspaceId, deletedAt: null },
                        deletedAt: null,
                    },
                    _count: { _all: true },
                }),
            ]);

            const statementIds = groupedTransactions.map((entry) => entry.statementId);
            const statements = statementIds.length > 0
                ? await prisma.statement.findMany({
                      where: {
                          id: { in: statementIds },
                      },
                      select: {
                          id: true,
                          month: true,
                      },
                  })
                : [];

            const monthCounts = Object.fromEntries(
                Array.from({ length: 12 }, (_, index) => [index + 1, 0])
            ) as Record<number, number>;

            const monthByStatementId = new Map(statements.map((statement) => [statement.id, statement.month]));
            for (const entry of groupedTransactions) {
                const month = monthByStatementId.get(entry.statementId);
                if (month) {
                    monthCounts[month] += entry._count._all;
                }
            }

            return NextResponse.json({
                totalTransactions: totalCount,
                annotatedTransactions: annotatedCount,
                pendingReview: totalCount - annotatedCount,
                totalIncomeKobo: (totalIncomeAggregate._sum.creditAmount ?? BigInt(0)).toString(),
                totalDBEKobo: (totalDBEAggregate._sum.debitAmount ?? BigInt(0)).toString(),
                monthCounts,
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

            // Ensure taxableAmount is null if not PARTIAL (which is no longer supported)
            const finalTaxableAmount = null;

            const annotation = await prisma.annotation.upsert({
                where: { transactionId: data.transactionId },
                create: {
                    transactionId: data.transactionId,
                    taxableStatus: data.taxableStatus,
                    taxableAmount: finalTaxableAmount,
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
            await prisma.annotation.updateMany({
                where: { transaction: { statementId: statement.id } },
                data: { deletedAt: new Date() },
            });
            await prisma.transaction.updateMany({
                where: { statementId: statement.id },
                data: { deletedAt: new Date() },
            });

            return NextResponse.json({ success: true, month: data.month });
        }

        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    } catch (error) {
        console.error('Annotations API error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
