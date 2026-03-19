import { adminProcedure, router } from '../../trpc/trpc.js';
import { z } from 'zod';

export const adminBillingRouter = router({
    getBillingStats: adminProcedure.query(async ({ ctx }) => {
        // Active Subscriptions
        const activeSubscribersCount = await ctx.prisma.subscription.count({
            where: {
                status: 'active',
                plan: 'PRO'
            }
        });

        // Current Monthly Recurring Revenue (approximated for this example: 15,000 NGN per PRO user per month)
        const currentMrr = activeSubscribersCount * 15000;

        // Total Revenue (all successful transactions)
        const successfulTransactions = await ctx.prisma.paystackTransaction.aggregate({
            where: { status: 'success' },
            _sum: { amount: true }
        });
        
        // Amount is in Kobo (BigInt), convert to NGN (Number)
        // Note: Prisma aggregate on BigInt returns BigInt. We convert safely.
        const totalRevenueKobo = successfulTransactions._sum.amount || BigInt(0);
        const totalRevenueNgn = Number(totalRevenueKobo) / 100;

        // Failed Payments past 24h
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        
        const failedPayments24h = await ctx.prisma.paystackTransaction.count({
            where: {
                status: 'failed',
                createdAt: { gte: yesterday }
            }
        });

        return {
            activeSubscribersCount,
            currentMrr,
            totalRevenueNgn,
            failedPayments24h,
            // Mock trend data
            mrrTrend: '+12.5%',
            mrrTrendDir: 'up',
            arpuNgn: activeSubscribersCount > 0 ? currentMrr / activeSubscribersCount : 0,
        };
    }),

    getPlans: adminProcedure.query(async () => {
        // Return static plan configuration for now. In a real app this would likely be fetched from DB or Paystack.
        return [
            { id: "free", name: "Free Plan", price: "₦0", features: ["Basic reporting", "100 transactions/month"], badge: "DEFAULT" },
            { id: "pro", name: "Pro Plan", price: "₦15,000", features: ["Advanced Analytics", "Up to 6M bank transactions", "24/7 Priority Support"], badge: "POPULAR" },
        ];
    }),

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
                where.status = status.toLowerCase(); // success, failed, abandoned
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

            // Fetch users manually since there is no strict relation defined on PaystackTransaction
            const userIds = [...new Set(items.map((i) => i.userId).filter((id): id is string => Boolean(id)))];
            const users = await ctx.prisma.user.findMany({
                where: { id: { in: userIds } },
                select: { id: true, name: true, email: true, plan: true }
            });
            const userMap = new Map(users.map((u) => [u.id, u]));

            // Serialize amounts from BigInt to String to avoid TRPC serialization errors
            const serializedItems = items.map((t) => ({
                ...t,
                user: t.userId ? userMap.get(t.userId) : null,
                amountKobo: t.amount.toString(),
                amountNgn: Number(t.amount) / 100
            }));

            return { items: serializedItems, nextCursor };
        })
});
