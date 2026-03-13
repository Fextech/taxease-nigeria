import { z } from 'zod';
import { router, protectedProcedure } from '../trpc/trpc.js';
import { logAction } from '../services/audit.js';
import { TRPCError } from '@trpc/server';

export const annotationsRouter = router({
    // ─── List Transactions with Annotations ──────────────
    list: protectedProcedure
        .input(
            z.object({
                workspaceId: z.string().cuid(),
                month: z.number().int().min(1).max(12).optional(),
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

            // Build where clause
            const where: Record<string, unknown> = {
                statement: { workspaceId: input.workspaceId },
            };
            if (input.month) {
                where.statement = { workspaceId: input.workspaceId, month: input.month };
            }

            const transactions = await ctx.prisma.transaction.findMany({
                where,
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
                    statement: {
                        select: { month: true, bankName: true },
                    },
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

            // Serialize BigInt values to strings for JSON transport
            return transactions.map((tx) => ({
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
        }),

    // ─── Stats ───────────────────────────────────────────
    stats: protectedProcedure
        .input(z.object({ workspaceId: z.string().cuid() }))
        .query(async ({ ctx, input }) => {
            const workspace = await ctx.prisma.workspace.findUnique({
                where: { id: input.workspaceId },
            });

            if (!workspace || workspace.userId !== ctx.user.id) {
                throw new TRPCError({ code: 'NOT_FOUND', message: 'Workspace not found.' });
            }

            // Count transactions
            const totalCount = await ctx.prisma.transaction.count({
                where: { statement: { workspaceId: input.workspaceId } },
            });

            // Count annotated (COMPLETE status)
            const annotatedCount = await ctx.prisma.annotation.count({
                where: {
                    status: 'COMPLETE',
                    transaction: { statement: { workspaceId: input.workspaceId } },
                },
            });

            // Sum taxable amounts for real-time liability estimate
            const taxableAnnotations = await ctx.prisma.annotation.findMany({
                where: {
                    status: 'COMPLETE',
                    taxableStatus: { in: ['YES', 'PARTIAL'] },
                    transaction: { statement: { workspaceId: input.workspaceId } },
                },
                select: {
                    taxableStatus: true,
                    taxableAmount: true,
                    transaction: {
                        select: { creditAmount: true },
                    },
                },
            });

            // Calculate total taxable income (kobo)
            let totalTaxableKobo = 0n;
            for (const ann of taxableAnnotations) {
                if (ann.taxableStatus === 'PARTIAL' && ann.taxableAmount != null) {
                    totalTaxableKobo += ann.taxableAmount;
                } else if (ann.taxableStatus === 'YES') {
                    totalTaxableKobo += ann.transaction.creditAmount;
                }
            }

            return {
                totalTransactions: totalCount,
                annotatedTransactions: annotatedCount,
                pendingReview: totalCount - annotatedCount,
                totalTaxableKobo: totalTaxableKobo.toString(),
            };
        }),

    // ─── Upsert Annotation ───────────────────────────────
    upsert: protectedProcedure
        .input(
            z.object({
                transactionId: z.string().cuid(),
                taxableStatus: z.enum(['YES', 'NO', 'PARTIAL']),
                taxableAmount: z.string().optional(), // String for BigInt transport
                taxCategory: z.enum([
                    'EMPLOYMENT', 'BUSINESS', 'RENTAL',
                    'INVESTMENT', 'FOREIGN', 'EXEMPT', 'UNCLASSIFIED',
                ]).default('UNCLASSIFIED'),
                reason: z.string().max(500).optional(),
                reliefType: z.string().max(100).optional(),
                notes: z.string().max(2000).optional(),
                status: z.enum(['UNANNOTATED', 'IN_PROGRESS', 'COMPLETE', 'FLAGGED']).default('COMPLETE'),
            })
        )
        .mutation(async ({ ctx, input }) => {
            // Verify the transaction belongs to this user
            const transaction = await ctx.prisma.transaction.findUnique({
                where: { id: input.transactionId },
                include: {
                    statement: { select: { workspace: { select: { userId: true, status: true } } } },
                },
            });

            if (!transaction || transaction.statement.workspace.userId !== ctx.user.id) {
                throw new TRPCError({ code: 'NOT_FOUND', message: 'Transaction not found.' });
            }

            if (transaction.statement.workspace.status === 'LOCKED') {
                throw new TRPCError({ code: 'FORBIDDEN', message: 'Workspace is locked.' });
            }

            // Validate partial amount
            if (input.taxableStatus === 'PARTIAL' && !input.taxableAmount) {
                throw new TRPCError({
                    code: 'BAD_REQUEST',
                    message: 'Taxable amount is required when status is PARTIAL.',
                });
            }

            const annotation = await ctx.prisma.annotation.upsert({
                where: { transactionId: input.transactionId },
                create: {
                    transactionId: input.transactionId,
                    taxableStatus: input.taxableStatus,
                    taxableAmount: input.taxableAmount ? BigInt(input.taxableAmount) : null,
                    taxCategory: input.taxCategory,
                    reason: input.reason || null,
                    reliefType: input.reliefType || null,
                    notes: input.notes || null,
                    status: input.status,
                    annotatedBy: ctx.user.id,
                },
                update: {
                    taxableStatus: input.taxableStatus,
                    taxableAmount: input.taxableAmount ? BigInt(input.taxableAmount) : null,
                    taxCategory: input.taxCategory,
                    reason: input.reason || null,
                    reliefType: input.reliefType || null,
                    notes: input.notes || null,
                    status: input.status,
                    annotatedBy: ctx.user.id,
                },
            });

            await logAction({
                userId: ctx.user.id,
                entityType: 'Annotation',
                entityId: annotation.id,
                action: 'UPSERT',
                newValue: {
                    taxableStatus: input.taxableStatus,
                    taxCategory: input.taxCategory,
                },
            });

            return {
                ...annotation,
                taxableAmount: annotation.taxableAmount?.toString() ?? null,
                computedLiability: annotation.computedLiability.toString(),
            };
        }),

    // ─── Bulk Upsert ─────────────────────────────────────
    bulkUpsert: protectedProcedure
        .input(
            z.object({
                transactionIds: z.array(z.string().cuid()).min(1),
                taxableStatus: z.enum(['YES', 'NO', 'PARTIAL']),
                taxCategory: z.enum([
                    'EMPLOYMENT', 'BUSINESS', 'RENTAL',
                    'INVESTMENT', 'FOREIGN', 'EXEMPT', 'UNCLASSIFIED',
                ]).optional(),
                reason: z.string().max(500).optional(),
            })
        )
        .mutation(async ({ ctx, input }) => {
            // Verify all transactions belong to this user
            const transactions = await ctx.prisma.transaction.findMany({
                where: {
                    id: { in: input.transactionIds },
                    statement: { workspace: { userId: ctx.user.id } },
                },
                select: { id: true },
            });

            if (transactions.length !== input.transactionIds.length) {
                throw new TRPCError({
                    code: 'BAD_REQUEST',
                    message: 'Some transactions were not found or do not belong to you.',
                });
            }

            // Upsert all annotations in a transaction
            const results = await ctx.prisma.$transaction(
                input.transactionIds.map((txId) =>
                    ctx.prisma.annotation.upsert({
                        where: { transactionId: txId },
                        create: {
                            transactionId: txId,
                            taxableStatus: input.taxableStatus,
                            taxCategory: input.taxCategory || 'UNCLASSIFIED',
                            reason: input.reason || null,
                            status: 'COMPLETE',
                            annotatedBy: ctx.user.id,
                        },
                        update: {
                            taxableStatus: input.taxableStatus,
                            taxCategory: input.taxCategory || 'UNCLASSIFIED',
                            reason: input.reason || null,
                            status: 'COMPLETE',
                            annotatedBy: ctx.user.id,
                        },
                    })
                )
            );

            await logAction({
                userId: ctx.user.id,
                entityType: 'Annotation',
                entityId: 'bulk',
                action: 'BULK_UPSERT',
                newValue: {
                    count: results.length,
                    taxableStatus: input.taxableStatus,
                    taxCategory: input.taxCategory,
                },
            });

            return { updated: results.length };
        }),
});
