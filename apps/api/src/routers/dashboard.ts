import { z } from 'zod';
import { router, protectedProcedure } from '../trpc/trpc.js';
import { TRPCError } from '@trpc/server';
import { computeTax, type Relief } from '@taxease/shared';

export const dashboardRouter = router({
    // ─── Overview ────────────────────────────────────────
    overview: protectedProcedure
        .input(z.object({ workspaceId: z.string().cuid() }))
        .query(async ({ ctx, input }) => {
            const workspace = await ctx.prisma.workspace.findUnique({
                where: { id: input.workspaceId },
            });

            if (!workspace || workspace.userId !== ctx.user.id) {
                throw new TRPCError({ code: 'NOT_FOUND', message: 'Workspace not found.' });
            }

            // ── 1. Tax Computation (same logic as reports) ───
            const taxableAnnotations = await ctx.prisma.annotation.findMany({
                where: {
                    status: 'COMPLETE',
                    taxableStatus: { in: ['YES', 'PARTIAL'] },
                    transaction: { statement: { workspaceId: input.workspaceId } },
                },
                select: {
                    taxableStatus: true,
                    taxableAmount: true,
                    transaction: { select: { creditAmount: true } },
                },
            });

            let grossIncome = 0n;
            for (const ann of taxableAnnotations) {
                if (ann.taxableStatus === 'PARTIAL' && ann.taxableAmount != null) {
                    grossIncome += ann.taxableAmount;
                } else {
                    grossIncome += ann.transaction.creditAmount;
                }
            }

            const reliefs: Relief[] = [];
            const pensionAmount = (grossIncome * 8n) / 100n;
            if (pensionAmount > 0n) {
                reliefs.push({ label: 'Pension (RSA)', amount: pensionAmount });
            }
            const nhfAmount = (grossIncome * 25n) / 1000n;
            if (nhfAmount > 0n) {
                reliefs.push({ label: 'NHF', amount: nhfAmount });
            }

            const taxResult = computeTax({
                grossIncome,
                reliefs,
                taxYear: workspace.taxYear,
            });

            // ── 2. Monthly Income Distribution ──────────────
            const transactions = await ctx.prisma.transaction.findMany({
                where: { statement: { workspaceId: input.workspaceId } },
                select: {
                    creditAmount: true,
                    statement: { select: { month: true } },
                },
            });

            const monthlyIncome: Record<number, bigint> = {};
            for (let m = 1; m <= 12; m++) monthlyIncome[m] = 0n;
            for (const tx of transactions) {
                if (tx.creditAmount > 0n) {
                    monthlyIncome[tx.statement.month] += tx.creditAmount;
                }
            }

            // Find max for chart normalization
            let maxMonthly = 0n;
            for (const v of Object.values(monthlyIncome)) {
                if (v > maxMonthly) maxMonthly = v;
            }

            const monthlyChart = Object.entries(monthlyIncome).map(([month, amount]) => ({
                month: Number(month),
                amount: amount.toString(),
                pct: maxMonthly > 0n ? Number((amount * 100n) / maxMonthly) : 0,
            }));

            // ── 3. Recent Transactions ──────────────────────
            const recentTxns = await ctx.prisma.transaction.findMany({
                where: { statement: { workspaceId: input.workspaceId } },
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

            // ── 4. Compliance (which months have statements) ─
            const statements = await ctx.prisma.statement.findMany({
                where: { workspaceId: input.workspaceId },
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

            // ── 5. Annotation stats ─────────────────────────
            const totalTxnCount = await ctx.prisma.transaction.count({
                where: { statement: { workspaceId: input.workspaceId } },
            });
            const annotatedCount = await ctx.prisma.annotation.count({
                where: {
                    status: 'COMPLETE',
                    transaction: { statement: { workspaceId: input.workspaceId } },
                },
            });

            return {
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
            };
        }),
});
