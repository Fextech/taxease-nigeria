import { z } from 'zod';
import { router, protectedProcedure } from '../trpc/trpc.js';
import { TRPCError } from '@trpc/server';
import { computeTax, type TaxComputationResult, type Relief } from '@banklens/shared';

export const reportsRouter = router({
    // ─── Generate Tax Report ─────────────────────────────
    generate: protectedProcedure
        .input(
            z.object({
                workspaceId: z.string().cuid(),
                taxYear: z.number().int().min(2020).max(2030).optional(),
                annualRentPaid: z.string().optional(), // kobo as string (BigInt)
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

            // 1. Aggregate taxable income from COMPLETE annotations (credits only)
            const taxableAnnotations = await ctx.prisma.annotation.findMany({
                where: {
                    deletedAt: null,
                    status: 'COMPLETE',
                    taxableStatus: 'YES',
                    transaction: {
                        statement: { workspaceId: input.workspaceId },
                        creditAmount: { gt: 0 },
                    },
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
                const amount = ann.transaction.creditAmount;
                grossIncome += amount;

                // Track by category
                const cat = ann.taxCategory || 'UNCLASSIFIED';
                categoryTotals[cat] = (categoryTotals[cat] || 0n) + amount;
            }

            // 1b. Direct Business Expenses (taxable debits)
            const dbeAnnotations = await ctx.prisma.annotation.findMany({
                where: {
                    deletedAt: null,
                    status: 'COMPLETE',
                    taxableStatus: 'YES',
                    transaction: {
                        statement: { workspaceId: input.workspaceId },
                        debitAmount: { gt: 0 },
                    },
                },
                select: {
                    transaction: { select: { debitAmount: true } },
                },
            });

            let totalDBE = 0n;
            for (const ann of dbeAnnotations) {
                totalDBE += ann.transaction.debitAmount;
            }

            const netTaxableIncome = grossIncome > totalDBE ? grossIncome - totalDBE : 0n;

            // 2. Build reliefs from saved workspace data
            const rawDeductions = workspace.additionalDeductions;
            const additionalDeductions = Array.isArray(rawDeductions) ? rawDeductions as { label: string; amount: string }[] : [];
            
            const reliefs: Relief[] = additionalDeductions.map(d => ({
                label: d.label || 'Additional Deduction',
                amount: BigInt(Math.max(0, parseInt(d.amount, 10) || 0))
            }));

            // 3. Compute tax using the shared engine
            let result: TaxComputationResult;
            try {
                result = computeTax({
                    grossIncome: netTaxableIncome,
                    reliefs,
                    taxYear: workspace.taxYear,
                    annualRentPaid: input.annualRentPaid ? BigInt(input.annualRentPaid) : undefined,
                });
            } catch (error) {
                throw new TRPCError({
                    code: 'BAD_REQUEST',
                    message: error instanceof Error ? error.message : 'Tax computation failed.',
                });
            }

            // 4. Get annotation stats
            const totalTransactions = await ctx.prisma.transaction.count({
                where: { deletedAt: null, statement: { workspaceId: input.workspaceId } },
            });

            const annotatedTransactions = await ctx.prisma.annotation.count({
                where: {
                    deletedAt: null,
                    status: 'COMPLETE',
                    transaction: { statement: { workspaceId: input.workspaceId } },
                },
            });

            // 5. Serialize BigInt values and return
            return {
                taxYear: workspace.taxYear,
                grossIncome: result.grossIncome.toString(),
                cra: result.cra.toString(),
                rentRelief: result.rentRelief.toString(),
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
