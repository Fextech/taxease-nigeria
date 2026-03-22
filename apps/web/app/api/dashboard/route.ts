import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { computeTax, type Relief } from '@banklens/shared';

/**
 * POST /api/dashboard
 *
 * Overview aggregation endpoint for a workspace.
 */
export async function POST(request: Request) {
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { action, ...data } = body;

    try {
        if (action === 'overview') {
            const workspace = await prisma.workspace.findUnique({
                where: { id: data.workspaceId },
            });

            if (!workspace || workspace.userId !== session.user.id) {
                return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
            }

            const [
                grossIncomeAggregate,
                totalDBEAggregate,
                groupedCreditsByStatement,
                recentTxns,
                statements,
                totalTxnCount,
                annotatedCount,
            ] = await Promise.all([
                prisma.transaction.aggregate({
                    where: {
                        statement: { workspaceId: data.workspaceId, deletedAt: null },
                        deletedAt: null,
                        creditAmount: { gt: 0 },
                        annotation: {
                            is: {
                                deletedAt: null,
                                status: 'COMPLETE',
                                taxableStatus: 'YES',
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
                                deletedAt: null,
                                status: 'COMPLETE',
                                taxableStatus: 'YES',
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
                        creditAmount: { gt: 0 },
                    },
                    _sum: { creditAmount: true },
                }),
                prisma.transaction.findMany({
                    where: {
                        statement: { workspaceId: data.workspaceId, deletedAt: null },
                        deletedAt: null,
                    },
                    orderBy: { transactionDate: 'desc' },
                    take: 5,
                    select: {
                        id: true,
                        transactionDate: true,
                        description: true,
                        creditAmount: true,
                        debitAmount: true,
                        annotation: {
                            select: { taxableStatus: true, status: true },
                        },
                    },
                }),
                prisma.statement.findMany({
                    where: {
                        workspaceId: data.workspaceId,
                        deletedAt: null,
                    },
                    select: { id: true, month: true, parseStatus: true },
                }),
                prisma.transaction.count({
                    where: {
                        statement: { workspaceId: data.workspaceId, deletedAt: null },
                        deletedAt: null,
                    },
                }),
                prisma.annotation.count({
                    where: {
                        status: 'COMPLETE',
                        transaction: {
                            deletedAt: null,
                            statement: { workspaceId: data.workspaceId, deletedAt: null },
                        },
                    },
                }),
            ]);

            const grossIncome = grossIncomeAggregate._sum.creditAmount ?? BigInt(0);
            const totalDBE = totalDBEAggregate._sum.debitAmount ?? BigInt(0);

            // Net taxable = gross income - direct business expenses
            const netTaxableIncome = grossIncome > totalDBE ? grossIncome - totalDBE : BigInt(0);

            // Build reliefs from saved workspace additional deductions (same as reports page)
            const rawDeductions = (workspace as any).additionalDeductions;
            const additionalDeductions = Array.isArray(rawDeductions) ? rawDeductions as { label: string; amount: string }[] : [];

            const reliefs: Relief[] = additionalDeductions.map(d => ({
                label: d.label || 'Additional Deduction',
                amount: BigInt(Math.max(0, parseInt(d.amount, 10) || 0))
            }));

            const annualRentPaid = workspace.annualRentAmount || undefined;
            const taxResult = computeTax({
                grossIncome: netTaxableIncome,
                reliefs,
                taxYear: workspace.taxYear,
                annualRentPaid,
            });

            const monthlyIncome: Record<number, bigint> = {};
            for (let m = 1; m <= 12; m++) monthlyIncome[m] = BigInt(0);
            const statementMonthMap = new Map(statements.map((statement) => [statement.id, statement.month]));
            for (const entry of groupedCreditsByStatement) {
                const month = statementMonthMap.get(entry.statementId);
                if (month && entry._sum.creditAmount) {
                    monthlyIncome[month] += entry._sum.creditAmount;
                }
            }

            let maxMonthly = BigInt(0);
            for (const v of Object.values(monthlyIncome)) {
                if (v > maxMonthly) maxMonthly = v;
            }

            const monthlyChart = Object.entries(monthlyIncome).map(([month, amount]) => ({
                month: Number(month),
                amount: amount.toString(),
                pct: maxMonthly > BigInt(0) ? Number((amount * BigInt(100)) / maxMonthly) : 0,
            }));

            // 3. Compliance
            const statementMonths = new Set(statements.map((s) => s.month));
            const quarters = [
                { label: 'Q1 Statements', months: [1, 2, 3] },
                { label: 'Q2 Statements', months: [4, 5, 6] },
                { label: 'Q3 Statements', months: [7, 8, 9] },
                { label: 'Q4 Statements', months: [10, 11, 12] },
            ];

            const compliance = quarters.map((q) => {
                const uploaded = q.months.filter((m) => statementMonths.has(m)).length;
                const status = uploaded === 3 ? 'FILED' : uploaded > 0 ? 'PENDING' : 'UPCOMING';
                return { quarter: q.label, status, uploaded, total: 3 };
            });

            return NextResponse.json({
                taxYear: workspace.taxYear,
                metrics: {
                    grossIncome: taxResult.grossIncome.toString(),
                    taxableIncome: taxResult.taxableIncome.toString(),
                    cra: taxResult.cra.toString(),
                    totalReliefs: taxResult.totalReliefs.toString(),
                    rentRelief: taxResult.rentRelief.toString(),
                    grandTotalRelief: (taxResult.cra + taxResult.rentRelief + taxResult.totalReliefs).toString(),
                    taxLiability: taxResult.taxLiability.toString(),
                    effectiveRate: taxResult.effectiveRate,
                },
                monthlyChart,
                recentTransactions: recentTxns.map((tx) => ({
                    id: tx.id,
                    date: tx.transactionDate.toISOString(),
                    description: tx.description,
                    creditAmount: tx.creditAmount.toString(),
                    debitAmount: tx.debitAmount.toString(),
                    annotationStatus: tx.annotation?.status || null,
                    taxableStatus: tx.annotation?.taxableStatus || null,
                })),
                compliance,
                stats: {
                    totalTransactions: totalTxnCount,
                    annotatedTransactions: annotatedCount,
                },
            });
        }

        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    } catch (error) {
        console.error('Dashboard API error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
