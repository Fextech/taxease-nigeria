import { z } from 'zod';
import { router, protectedProcedure } from '../trpc/trpc.js';
import { TRPCError } from '@trpc/server';
import { computeTax, type TaxComputationResult, type Relief } from '@taxease/shared';

export const reportsRouter = router({
    // ─── Generate Tax Report ─────────────────────────────
    generate: protectedProcedure
        .input(
            z.object({
                workspaceId: z.string().cuid(),
                taxYear: z.number().int().min(2020).max(2030).default(2023),
            })
        )
        .query(async ({ ctx, input }) => {
            // Verify workspace ownership
            const workspace = await ctx.prisma.workspace.findUnique({
                where: { id: input.workspaceId },
            });

            if (!workspace || workspace.userId !== ctx.user.id) {
                throw new TRPCError({ code: 'NOT_FOUND', message: 'Workspace not found.' });
            }

            // 1. Aggregate taxable income from COMPLETE annotations
            const taxableAnnotations = await ctx.prisma.annotation.findMany({
                where: {
                    status: 'COMPLETE',
                    taxableStatus: { in: ['YES', 'PARTIAL'] },
                    transaction: { statement: { workspaceId: input.workspaceId } },
                },
                select: {
                    taxableStatus: true,
                    taxableAmount: true,
                    taxCategory: true,
                    transaction: {
                        select: { creditAmount: true },
                    },
                },
            });

            // Sum gross income (kobo)
            let grossIncome = 0n;
            const categoryTotals: Record<string, bigint> = {};

            for (const ann of taxableAnnotations) {
                let amount: bigint;
                if (ann.taxableStatus === 'PARTIAL' && ann.taxableAmount != null) {
                    amount = ann.taxableAmount;
                } else {
                    amount = ann.transaction.creditAmount;
                }
                grossIncome += amount;

                // Track by category
                const cat = ann.taxCategory || 'UNCLASSIFIED';
                categoryTotals[cat] = (categoryTotals[cat] || 0n) + amount;
            }

            // 2. Build reliefs array (standard statutory deductions based on gross)
            const reliefs: Relief[] = [];

            // RSA Pension contribution (8% of gross, up to a reasonable cap)
            const pensionAmount = (grossIncome * 8n) / 100n;
            if (pensionAmount > 0n) {
                reliefs.push({ label: 'Pension Fund (RSA) — 8%', amount: pensionAmount });
            }

            // NHF (2.5% of gross)
            const nhfAmount = (grossIncome * 25n) / 1000n;
            if (nhfAmount > 0n) {
                reliefs.push({ label: 'National Housing Fund (NHF) — 2.5%', amount: nhfAmount });
            }

            // 3. Compute tax using the shared engine
            let result: TaxComputationResult;
            try {
                result = computeTax({
                    grossIncome,
                    reliefs,
                    taxYear: input.taxYear,
                });
            } catch (error) {
                throw new TRPCError({
                    code: 'BAD_REQUEST',
                    message: error instanceof Error ? error.message : 'Tax computation failed.',
                });
            }

            // 4. Get annotation stats
            const totalTransactions = await ctx.prisma.transaction.count({
                where: { statement: { workspaceId: input.workspaceId } },
            });

            const annotatedTransactions = await ctx.prisma.annotation.count({
                where: {
                    status: 'COMPLETE',
                    transaction: { statement: { workspaceId: input.workspaceId } },
                },
            });

            // 5. Serialize BigInt values and return
            return {
                taxYear: input.taxYear,
                grossIncome: result.grossIncome.toString(),
                cra: result.cra.toString(),
                totalReliefs: result.totalReliefs.toString(),
                taxableIncome: result.taxableIncome.toString(),
                taxLiability: result.taxLiability.toString(),
                effectiveRate: result.effectiveRate,
                minimumTaxApplied: result.minimumTaxApplied,
                breakdown: result.breakdown.map((b) => ({
                    label: b.label,
                    rate: b.rate,
                    taxableInBand: b.taxableInBand.toString(),
                    taxInBand: b.taxInBand.toString(),
                })),
                reliefs: reliefs.map((r) => ({
                    label: r.label,
                    amount: r.amount.toString(),
                })),
                categoryTotals: Object.fromEntries(
                    Object.entries(categoryTotals).map(([k, v]) => [k, v.toString()])
                ),
                stats: {
                    totalTransactions,
                    annotatedTransactions,
                    completionPct: totalTransactions > 0
                        ? Math.round((annotatedTransactions / totalTransactions) * 100)
                        : 0,
                },
                workspaceStatus: workspace.status,
            };
        }),
});
