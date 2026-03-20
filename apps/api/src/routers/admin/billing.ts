import { adminProcedure, router } from '../../trpc/trpc.js';
import { z } from 'zod';

// ─── Paystack API Helper ─────────────────────────────────

const PAYSTACK_BASE = 'https://api.paystack.co';

async function paystackFetch<T = any>(
    endpoint: string,
    opts?: { method?: string; body?: unknown; params?: Record<string, string> }
): Promise<T> {
    const secretKey = process.env.PAYSTACK_SECRET_KEY;
    if (!secretKey) {
        throw new Error('PAYSTACK_SECRET_KEY is not configured');
    }

    let url = `${PAYSTACK_BASE}${endpoint}`;
    if (opts?.params) {
        const qs = new URLSearchParams(opts.params).toString();
        url += `?${qs}`;
    }

    const res = await fetch(url, {
        method: opts?.method || 'GET',
        headers: {
            Authorization: `Bearer ${secretKey}`,
            'Content-Type': 'application/json',
        },
        ...(opts?.body ? { body: JSON.stringify(opts.body) } : {}),
    });

    const data = await res.json();
    if (!data.status) {
        throw new Error(data.message || `Paystack API error on ${endpoint}`);
    }

    return data;
}

// ─── Default Pricing (fallbacks from @banklens/shared) ───

const DEFAULT_PRICING = {
    workspaceUnlockKobo: '500000',     // ₦5,000
    creditPriceKobo: '25000',          // ₦250 per credit
    bankAccountAddonKobo: '300000',    // ₦3,000
    standardCredits: '15',              // credits included with unlock
};

// ─── Router ──────────────────────────────────────────────

export const adminBillingRouter = router({
    // ─── Billing KPI Stats ───────────────────────────────
    getBillingStats: adminProcedure.query(async ({ ctx }) => {
        // Total Revenue (all successful transactions)
        const successfulTransactions = await ctx.prisma.paystackTransaction.aggregate({
            where: { status: 'success' },
            _sum: { amount: true },
            _count: true,
        });
        const totalRevenueKobo = successfulTransactions._sum.amount || BigInt(0);
        const totalRevenueNgn = Number(totalRevenueKobo) / 100;
        const totalSuccessfulTx = successfulTransactions._count || 0;

        // Workspaces unlocked
        const workspacesUnlocked = await ctx.prisma.workspace.count({
            where: { isUnlocked: true },
        });

        // Credits purchased (sum of all CreditPurchase records)
        const creditsPurchased = await ctx.prisma.creditPurchase.aggregate({
            _sum: { credits: true },
        });
        const totalCreditsPurchased = creditsPurchased._sum.credits || 0;

        // Revenue by type
        const unlockRevenue = await ctx.prisma.paystackTransaction.aggregate({
            where: { status: 'success', type: 'workspace_unlock' },
            _sum: { amount: true },
            _count: true,
        });
        const creditRevenue = await ctx.prisma.paystackTransaction.aggregate({
            where: { status: 'success', type: 'credit_purchase' },
            _sum: { amount: true },
            _count: true,
        });
        const bankRevenue = await ctx.prisma.paystackTransaction.aggregate({
            where: { status: 'success', type: 'bank_addon' },
            _sum: { amount: true },
            _count: true,
        });

        // Failed Payments past 24h
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const failedPayments24h = await ctx.prisma.paystackTransaction.count({
            where: {
                status: 'failed',
                createdAt: { gte: yesterday },
            },
        });

        // Paystack balance (live)
        let availableBalance = 0;
        try {
            const balanceRes = await paystackFetch<{ data: Array<{ currency: string; balance: number }> }>('/balance');
            const ngnBalance = balanceRes.data?.find((b) => b.currency === 'NGN');
            if (ngnBalance) {
                availableBalance = ngnBalance.balance / 100;
            }
        } catch {
            // Paystack may be unreachable; fall back to 0
        }

        return {
            totalRevenueNgn,
            totalSuccessfulTx,
            workspacesUnlocked,
            totalCreditsPurchased,
            failedPayments24h,
            availableBalance,
            revenueByType: {
                unlock: { count: unlockRevenue._count || 0, amountNgn: Number(unlockRevenue._sum.amount || 0) / 100 },
                credits: { count: creditRevenue._count || 0, amountNgn: Number(creditRevenue._sum.amount || 0) / 100 },
                bankAddon: { count: bankRevenue._count || 0, amountNgn: Number(bankRevenue._sum.amount || 0) / 100 },
            },
        };
    }),

    // ─── Get Pricing Config ──────────────────────────────
    getPricingConfig: adminProcedure.query(async ({ ctx }) => {
        // Read from AppConfig table, falling back to defaults
        const keys = ['workspaceUnlockKobo', 'creditPriceKobo', 'bankAccountAddonKobo', 'standardCredits'];
        const configs = await ctx.prisma.appConfig.findMany({
            where: { key: { in: keys } },
        });

        const configMap = new Map(configs.map((c) => [c.key, c.value]));
        console.log('[getPricingConfig] DB configs:', configs);
        console.log('[getPricingConfig] configMap:', Object.fromEntries(configMap));

        return {
            workspaceUnlockKobo: Number(configMap.get('workspaceUnlockKobo') || DEFAULT_PRICING.workspaceUnlockKobo),
            workspaceUnlockNgn: Number(configMap.get('workspaceUnlockKobo') || DEFAULT_PRICING.workspaceUnlockKobo) / 100,
            creditPriceKobo: Number(configMap.get('creditPriceKobo') || DEFAULT_PRICING.creditPriceKobo),
            creditPriceNgn: Number(configMap.get('creditPriceKobo') || DEFAULT_PRICING.creditPriceKobo) / 100,
            bankAccountAddonKobo: Number(configMap.get('bankAccountAddonKobo') || DEFAULT_PRICING.bankAccountAddonKobo),
            bankAccountAddonNgn: Number(configMap.get('bankAccountAddonKobo') || DEFAULT_PRICING.bankAccountAddonKobo) / 100,
            standardCredits: Number(configMap.get('standardCredits') || DEFAULT_PRICING.standardCredits),
        };
    }),

    // ─── Update Pricing ──────────────────────────────────
    updatePricing: adminProcedure
        .input(
            z.object({
                workspaceUnlockKobo: z.number().int().min(0).optional(),
                creditPriceKobo: z.number().int().min(0).optional(),
                bankAccountAddonKobo: z.number().int().min(0).optional(),
                standardCredits: z.number().int().min(1).optional(),
            })
        )
        .mutation(async ({ ctx, input }) => {
            const updates: Array<{ key: string; value: string }> = [];

            if (input.workspaceUnlockKobo !== undefined) {
                updates.push({ key: 'workspaceUnlockKobo', value: String(input.workspaceUnlockKobo) });
            }
            if (input.creditPriceKobo !== undefined) {
                updates.push({ key: 'creditPriceKobo', value: String(input.creditPriceKobo) });
            }
            if (input.bankAccountAddonKobo !== undefined) {
                updates.push({ key: 'bankAccountAddonKobo', value: String(input.bankAccountAddonKobo) });
            }
            if (input.standardCredits !== undefined) {
                updates.push({ key: 'standardCredits', value: String(input.standardCredits) });
            }

            // Upsert each config key
            for (const { key, value } of updates) {
                await ctx.prisma.appConfig.upsert({
                    where: { key },
                    create: {
                        key,
                        value,
                        description: `Billing pricing: ${key}`,
                        updatedBy: ctx.admin.id,
                    },
                    update: {
                        value,
                        updatedBy: ctx.admin.id,
                    },
                });
            }

            // Audit log
            await ctx.prisma.adminAuditLog.create({
                data: {
                    adminId: ctx.admin.id,
                    adminEmail: ctx.admin.email,
                    adminRole: ctx.admin.role,
                    actionCode: 'PRICING_UPDATED',
                    metadata: { updates },
                },
            });

            return { success: true, updated: updates.length };
        }),

    // ─── Sync Transactions from Paystack ─────────────────
    syncPaystackTransactions: adminProcedure.mutation(async ({ ctx }) => {
        const res = await paystackFetch<{ data: any[]; meta: any }>('/transaction', {
            params: { perPage: '100' },
        });

        const transactions = res.data || [];
        let synced = 0;
        let skipped = 0;

        for (const tx of transactions) {
            const reference = tx.reference;
            if (!reference) {
                skipped++;
                continue;
            }

            const existing = await ctx.prisma.paystackTransaction.findUnique({
                where: { reference },
            });

            if (existing) {
                if (existing.status !== tx.status) {
                    await ctx.prisma.paystackTransaction.update({
                        where: { reference },
                        data: {
                            status: tx.status,
                            paystackData: tx,
                        },
                    });
                    synced++;
                } else {
                    skipped++;
                }
            } else {
                try {
                    await ctx.prisma.paystackTransaction.create({
                        data: {
                            userId: tx.customer?.email || 'unknown',
                            reference,
                            amount: BigInt(tx.amount || 0),
                            currency: tx.currency || 'NGN',
                            status: tx.status || 'unknown',
                            type: tx.metadata?.type || 'paystack_sync',
                            metadata: tx.metadata || {},
                            paystackData: tx,
                        },
                    });
                    synced++;
                } catch {
                    skipped++;
                }
            }
        }

        await ctx.prisma.adminAuditLog.create({
            data: {
                adminId: ctx.admin.id,
                adminEmail: ctx.admin.email,
                adminRole: ctx.admin.role,
                actionCode: 'PAYSTACK_SYNC',
                metadata: { synced, skipped, totalFromPaystack: transactions.length },
            },
        });

        return { synced, skipped, totalFromPaystack: transactions.length };
    }),

    // ─── Local Transaction Ledger ────────────────────────
    listTransactions: adminProcedure
        .input(
            z.object({
                limit: z.number().min(1).max(100).default(20),
                cursor: z.string().nullish(),
                status: z.string().optional(),
            })
        )
        .query(async ({ ctx, input }) => {
            const { limit, cursor, status } = input;

            const where: any = {};
            if (status && status !== 'All') {
                where.status = status.toLowerCase();
            }

            const items = await ctx.prisma.paystackTransaction.findMany({
                take: limit + 1,
                where,
                cursor: cursor ? { id: cursor } : undefined,
                orderBy: { createdAt: 'desc' },
            });

            let nextCursor: typeof cursor | undefined = undefined;
            if (items.length > limit) {
                const nextItem = items.pop();
                nextCursor = nextItem!.id;
            }

            const userIds = [...new Set(items.map((i) => i.userId).filter((id): id is string => Boolean(id)))];
            const users = await ctx.prisma.user.findMany({
                where: { id: { in: userIds } },
                select: { id: true, name: true, email: true, plan: true },
            });
            const userMap = new Map(users.map((u) => [u.id, u]));

            const serializedItems = items.map((t) => ({
                ...t,
                amount: t.amount.toString(),
                user: t.userId ? userMap.get(t.userId) : null,
                amountKobo: t.amount.toString(),
                amountNgn: Number(t.amount) / 100,
            }));

            return { items: serializedItems, nextCursor };
        }),
});
