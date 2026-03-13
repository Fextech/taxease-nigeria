import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { computeTax, type Relief } from '@taxease/shared';

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

            // 1. Tax Computation
            const taxableAnnotations = await prisma.annotation.findMany({
                where: {
                    status: 'COMPLETE',
                    taxableStatus: { in: ['YES', 'PARTIAL'] },
                    transaction: { statement: { workspaceId: data.workspaceId } },
                },
                select: {
                    taxableStatus: true,
                    taxableAmount: true,
                    transaction: { select: { creditAmount: true } },
                },
            });

            let grossIncome = BigInt(0);
            for (const ann of taxableAnnotations) {
                if (ann.taxableStatus === 'PARTIAL' && ann.taxableAmount != null) {
                    grossIncome += ann.taxableAmount;
                } else {
                    grossIncome += ann.transaction.creditAmount;
                }
            }

            const reliefs: Relief[] = [];
            const pensionAmount = (grossIncome * BigInt(8)) / BigInt(100);
            if (pensionAmount > BigInt(0)) {
                reliefs.push({ label: 'Pension (RSA)', amount: pensionAmount });
            }
            const nhfAmount = (grossIncome * BigInt(25)) / BigInt(1000);
            if (nhfAmount > BigInt(0)) {
                reliefs.push({ label: 'NHF', amount: nhfAmount });
            }

            const taxResult = computeTax({
                grossIncome,
                reliefs,
                taxYear: workspace.taxYear,
            });

            // 2. Monthly Distribution
            const transactions = await prisma.transaction.findMany({
                where: { statement: { workspaceId: data.workspaceId } },
                select: {
                    creditAmount: true,
                    statement: { select: { month: true } },
                },
            });

            const monthlyIncome: Record<number, bigint> = {};
            for (let m = 1; m <= 12; m++) monthlyIncome[m] = BigInt(0);
            for (const tx of transactions) {
                if (tx.creditAmount > BigInt(0)) {
                    monthlyIncome[tx.statement.month] += tx.creditAmount;
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

            // 3. Recent Transactions
            const recentTxns = await prisma.transaction.findMany({
                where: { statement: { workspaceId: data.workspaceId } },
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
            });

            // 4. Compliance
            const statements = await prisma.statement.findMany({
                where: { workspaceId: data.workspaceId },
                select: { month: true, parseStatus: true },
            });

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

            // 5. Stats
            const totalTxnCount = await prisma.transaction.count({
                where: { statement: { workspaceId: data.workspaceId } },
            });
            const annotatedCount = await prisma.annotation.count({
                where: {
                    status: 'COMPLETE',
                    transaction: { statement: { workspaceId: data.workspaceId } },
                },
            });

            return NextResponse.json({
                taxYear: workspace.taxYear,
                metrics: {
                    grossIncome: taxResult.grossIncome.toString(),
                    taxableIncome: taxResult.taxableIncome.toString(),
                    cra: taxResult.cra.toString(),
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
