import { z } from 'zod';
import { router, protectedProcedure } from '../trpc/trpc.js';
import { TRPCError } from '@trpc/server';
import { logAction } from '../services/audit.js';
import {
    WORKSPACE_UNLOCK_PRICE,
    ADDITIONAL_BANK_PRICE,
    CREDIT_PACKAGES,
    STANDARD_STATEMENT_CREDITS,
} from '@banklens/shared';

// ─── Helpers ─────────────────────────────────────────────

/**
 * Initialize a Paystack transaction via their REST API.
 * Returns the authorization URL and reference.
 */
async function initializePaystackTransaction(opts: {
    email: string;
    amountKobo: bigint;
    reference: string;
    metadata?: Record<string, unknown>;
    callbackUrl?: string;
}) {
    const secretKey = process.env.PAYSTACK_SECRET_KEY;
    if (!secretKey) {
        throw new Error('PAYSTACK_SECRET_KEY is not configured');
    }

    const res = await fetch('https://api.paystack.co/transaction/initialize', {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${secretKey}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            email: opts.email,
            amount: Number(opts.amountKobo), // Paystack expects number
            reference: opts.reference,
            metadata: opts.metadata || {},
            callback_url: opts.callbackUrl || process.env.PAYSTACK_CALLBACK_URL,
        }),
    });

    const data = await res.json();
    if (!data.status) {
        throw new Error(data.message || 'Failed to initialize Paystack transaction');
    }

    return {
        authorizationUrl: data.data.authorization_url as string,
        accessCode: data.data.access_code as string,
        reference: data.data.reference as string,
    };
}

/**
 * Generate a unique Paystack transaction reference.
 */
function generateReference(type: string): string {
    const ts = Date.now().toString(36);
    const rand = Math.random().toString(36).substring(2, 8);
    return `bl_${type}_${ts}_${rand}`;
}

// ─── Router ──────────────────────────────────────────────

export const billingRouter = router({
    // ─── Get Billing Status ──────────────────────────────
    getStatus: protectedProcedure
        .input(z.object({ workspaceId: z.string().cuid() }))
        .query(async ({ ctx, input }) => {
            const workspace = await ctx.prisma.workspace.findUnique({
                where: { id: input.workspaceId },
            });

            if (!workspace || workspace.userId !== ctx.user.id) {
                throw new TRPCError({ code: 'NOT_FOUND', message: 'Workspace not found.' });
            }

            return {
                isUnlocked: workspace.isUnlocked,
                allowedBanksCount: workspace.allowedBanksCount,
                statementCredits: workspace.statementCredits,
                pricing: {
                    workspaceUnlock: {
                        priceKobo: WORKSPACE_UNLOCK_PRICE.priceKobo.toString(),
                        displayPrice: WORKSPACE_UNLOCK_PRICE.displayPrice,
                        description: WORKSPACE_UNLOCK_PRICE.description,
                    },
                    additionalBank: {
                        priceKobo: ADDITIONAL_BANK_PRICE.priceKobo.toString(),
                        displayPrice: ADDITIONAL_BANK_PRICE.displayPrice,
                        description: ADDITIONAL_BANK_PRICE.description,
                    },
                    creditPackages: CREDIT_PACKAGES.map((cp) => ({
                        credits: cp.credits,
                        priceKobo: cp.priceKobo.toString(),
                        displayPrice: cp.displayPrice,
                        perCreditKobo: cp.perCreditKobo.toString(),
                    })),
                },
            };
        }),

    // ─── Unlock Full Workspace (12 months) ───────────────
    unlockWorkspace: protectedProcedure
        .input(
            z.object({
                workspaceId: z.string().cuid(),
                addBank: z.boolean().optional().default(false),
                callbackUrl: z.string().url().optional(),
            })
        )
        .mutation(async ({ ctx, input }) => {
            const workspace = await ctx.prisma.workspace.findUnique({
                where: { id: input.workspaceId },
            });

            if (!workspace || workspace.userId !== ctx.user.id) {
                throw new TRPCError({ code: 'NOT_FOUND', message: 'Workspace not found.' });
            }

            if (workspace.isUnlocked) {
                throw new TRPCError({
                    code: 'BAD_REQUEST',
                    message: 'Workspace is already unlocked.',
                });
            }

            // Calculate total: workspace unlock + optional additional bank
            let totalKobo = WORKSPACE_UNLOCK_PRICE.priceKobo;
            if (input.addBank) {
                totalKobo += ADDITIONAL_BANK_PRICE.priceKobo;
            }

            const reference = generateReference('unlock');

            // Record the pending transaction
            await ctx.prisma.paystackTransaction.create({
                data: {
                    userId: ctx.user.id,
                    reference,
                    amount: totalKobo,
                    status: 'pending',
                    type: 'workspace_unlock',
                    metadata: {
                        workspaceId: input.workspaceId,
                        addBank: input.addBank,
                    },
                },
            });

            // Initialize Paystack
            const paystack = await initializePaystackTransaction({
                email: ctx.user.email!,
                amountKobo: totalKobo,
                reference,
                callbackUrl: input.callbackUrl,
                metadata: {
                    type: 'workspace_unlock',
                    workspaceId: input.workspaceId,
                    addBank: input.addBank,
                },
            });

            return {
                authorizationUrl: paystack.authorizationUrl,
                reference: paystack.reference,
            };
        }),

    // ─── Purchase Statement Credits ──────────────────────
    purchaseCredits: protectedProcedure
        .input(
            z.object({
                workspaceId: z.string().cuid(),
                credits: z.number().int().min(1).max(100),
                callbackUrl: z.string().url().optional(),
            })
        )
        .mutation(async ({ ctx, input }) => {
            const workspace = await ctx.prisma.workspace.findUnique({
                where: { id: input.workspaceId },
            });

            if (!workspace || workspace.userId !== ctx.user.id) {
                throw new TRPCError({ code: 'NOT_FOUND', message: 'Workspace not found.' });
            }

            // Find the best matching credit package (or calculate at base rate)
            const basePackage = CREDIT_PACKAGES[0]; // 10 credits = ₦2,500
            const perCreditKobo = basePackage.perCreditKobo;
            const totalKobo = perCreditKobo * BigInt(input.credits);

            const reference = generateReference('credits');

            await ctx.prisma.paystackTransaction.create({
                data: {
                    userId: ctx.user.id,
                    reference,
                    amount: totalKobo,
                    status: 'pending',
                    type: 'credit_purchase',
                    metadata: {
                        workspaceId: input.workspaceId,
                        credits: input.credits,
                    },
                },
            });

            const paystack = await initializePaystackTransaction({
                email: ctx.user.email!,
                amountKobo: totalKobo,
                reference,
                callbackUrl: input.callbackUrl,
                metadata: {
                    type: 'credit_purchase',
                    workspaceId: input.workspaceId,
                    credits: input.credits,
                },
            });

            return {
                authorizationUrl: paystack.authorizationUrl,
                reference: paystack.reference,
                totalAmount: totalKobo.toString(),
                credits: input.credits,
            };
        }),

    addBankAccount: protectedProcedure
        .input(z.object({ 
            workspaceId: z.string().cuid(),
            callbackUrl: z.string().url().optional(),
        }))
        .mutation(async ({ ctx, input }) => {
            const workspace = await ctx.prisma.workspace.findUnique({
                where: { id: input.workspaceId },
            });

            if (!workspace || workspace.userId !== ctx.user.id) {
                throw new TRPCError({ code: 'NOT_FOUND', message: 'Workspace not found.' });
            }

            const reference = generateReference('bank');

            await ctx.prisma.paystackTransaction.create({
                data: {
                    userId: ctx.user.id,
                    reference,
                    amount: ADDITIONAL_BANK_PRICE.priceKobo,
                    status: 'pending',
                    type: 'bank_addon',
                    metadata: {
                        workspaceId: input.workspaceId,
                    },
                },
            });

            const paystack = await initializePaystackTransaction({
                email: ctx.user.email!,
                amountKobo: ADDITIONAL_BANK_PRICE.priceKobo,
                reference,
                callbackUrl: input.callbackUrl,
                metadata: {
                    type: 'bank_addon',
                    workspaceId: input.workspaceId,
                },
            });

            return {
                authorizationUrl: paystack.authorizationUrl,
                reference: paystack.reference,
            };
        }),

    // ─── Verify Payment (callback handler) ───────────────
    verifyPayment: protectedProcedure
        .input(z.object({ reference: z.string().min(1) }))
        .mutation(async ({ ctx, input }) => {
            // Look up our pending transaction
            const txn = await ctx.prisma.paystackTransaction.findUnique({
                where: { reference: input.reference },
            });

            if (!txn) {
                throw new TRPCError({
                    code: 'NOT_FOUND',
                    message: 'Transaction not found.',
                });
            }

            // Fix 1: Ownership check — only the user who initiated can verify
            if (txn.userId !== ctx.user.id) {
                throw new TRPCError({
                    code: 'NOT_FOUND',
                    message: 'Transaction not found.',
                });
            }

            if (txn.status === 'success') {
                return { status: 'already_verified' };
            }

            // Verify with Paystack
            const secretKey = process.env.PAYSTACK_SECRET_KEY;
            const res = await fetch(
                `https://api.paystack.co/transaction/verify/${encodeURIComponent(input.reference)}`,
                {
                    headers: { Authorization: `Bearer ${secretKey}` },
                }
            );
            const data = await res.json();

            if (!data.status || data.data.status !== 'success') {
                await ctx.prisma.paystackTransaction.updateMany({
                    where: { reference: input.reference, status: 'pending' },
                    data: { status: 'failed', paystackData: data.data },
                });
                throw new TRPCError({
                    code: 'BAD_REQUEST',
                    message: 'Payment verification failed.',
                });
            }

            // Fix 2: Amount cross-check — ensure Paystack amount matches what we stored
            if (BigInt(data.data.amount) !== txn.amount) {
                throw new TRPCError({
                    code: 'BAD_REQUEST',
                    message: 'Payment amount mismatch. Contact support.',
                });
            }

            // Fix 3: Atomic compare-and-swap — only one concurrent request can win
            const meta = txn.metadata as Record<string, unknown>;

            const updateResult = await ctx.prisma.paystackTransaction.updateMany({
                where: { reference: input.reference, status: 'pending' },
                data: { status: 'success', paystackData: data.data },
            });

            if (updateResult.count === 0) {
                // Another concurrent request already processed this — safe to return early
                return { status: 'already_verified' };
            }

            if (txn.type === 'workspace_unlock') {
                const updates: Record<string, unknown> = {
                    isUnlocked: true,
                    statementCredits: { increment: STANDARD_STATEMENT_CREDITS },
                };
                if (meta.addBank) {
                    updates.allowedBanksCount = { increment: 1 };
                }
                await ctx.prisma.workspace.update({
                    where: { id: meta.workspaceId as string },
                    data: updates,
                });
            } else if (txn.type === 'credit_purchase') {
                const credits = meta.credits as number;
                await ctx.prisma.workspace.update({
                    where: { id: meta.workspaceId as string },
                    data: { statementCredits: { increment: credits } },
                });
                await ctx.prisma.creditPurchase.create({
                    data: {
                        workspaceId: meta.workspaceId as string,
                        credits,
                        amountPaid: txn.amount,
                        paystackRef: input.reference,
                    },
                });
            } else if (txn.type === 'bank_addon') {
                await ctx.prisma.workspace.update({
                    where: { id: meta.workspaceId as string },
                    data: { allowedBanksCount: { increment: 1 } },
                });
            }

            await logAction({
                userId: ctx.user.id,
                entityType: 'PaystackTransaction',
                entityId: txn.id,
                action: 'PAYMENT_VERIFIED',
                newValue: { type: txn.type, amount: txn.amount.toString() },
            });

            return { status: 'success', type: txn.type };
        }),

    // ─── Purchase History ────────────────────────────────
    purchaseHistory: protectedProcedure
        .input(z.object({ workspaceId: z.string().cuid() }))
        .query(async ({ ctx, input }) => {
            const workspace = await ctx.prisma.workspace.findUnique({
                where: { id: input.workspaceId },
            });

            if (!workspace || workspace.userId !== ctx.user.id) {
                throw new TRPCError({ code: 'NOT_FOUND', message: 'Workspace not found.' });
            }

            const transactions = await ctx.prisma.paystackTransaction.findMany({
                where: { userId: ctx.user.id, status: 'success' },
                orderBy: { createdAt: 'desc' },
                take: 20,
            });

            return transactions.map((t) => ({
                id: t.id,
                reference: t.reference,
                amount: t.amount.toString(),
                type: t.type,
                createdAt: t.createdAt.toISOString(),
            }));
        }),
});
