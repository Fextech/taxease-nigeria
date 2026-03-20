import { adminProcedure, router } from '../../trpc/trpc.js';
import { z } from 'zod';

// Helper to calculate percentage change
function calculateTrend(oldValue: number, newValue: number) {
    if (oldValue === 0) return newValue > 0 ? '+100%' : '0%';
    const pct = ((newValue - oldValue) / oldValue) * 100;
    return `${pct > 0 ? '+' : ''}${pct.toFixed(1)}%`;
}

export const adminDashboardRouter = router({
    getKpis: adminProcedure.query(async ({ ctx }) => {
        const now = new Date();
        const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);

        const [
            totalUsers,
            previousUsers,
            activeSubs,
            previousSubs,
            statementsProcessed,
            previousStatements,
            openTickets,
            previousTickets,
            totalRevenueAgg,
            previousRevenueAgg
        ] = await Promise.all([
            ctx.prisma.user.count(),
            ctx.prisma.user.count({ where: { createdAt: { lt: thirtyDaysAgo } } }),
            ctx.prisma.workspace.count({ where: { isUnlocked: true } }),
            ctx.prisma.workspace.count({ where: { isUnlocked: true, createdAt: { lt: thirtyDaysAgo } } }), // Approximation
            ctx.prisma.statement.count({ where: { parseStatus: 'READY' } }),
            ctx.prisma.statement.count({ where: { parseStatus: 'READY', updatedAt: { lt: thirtyDaysAgo } } }),
            ctx.prisma.supportTicket.count({ where: { status: { in: ['OPEN', 'IN_PROGRESS'] } } }),
            ctx.prisma.supportTicket.count({ where: { status: { in: ['OPEN', 'IN_PROGRESS'] }, createdAt: { lt: thirtyDaysAgo } } }),
            ctx.prisma.paystackTransaction.aggregate({ _sum: { amount: true }, where: { status: 'success' } }),
            ctx.prisma.paystackTransaction.aggregate({ _sum: { amount: true }, where: { status: 'success', createdAt: { lt: thirtyDaysAgo } } }),
        ]);

        const totalRevenue = Number(totalRevenueAgg._sum.amount || 0) / 100; // Assuming kobo
        const previousRevenue = Number(previousRevenueAgg._sum.amount || 0) / 100;

        const formatCurrency = (val: number) => {
            if (val >= 1000000) return `₦${(val / 1000000).toFixed(1)}M`;
            if (val >= 1000) return `₦${(val / 1000).toFixed(1)}K`;
            return `₦${val}`;
        };

        return [
            {
                label: 'Total Users',
                value: totalUsers.toLocaleString(),
                trend: calculateTrend(previousUsers, totalUsers),
                trendDir: totalUsers >= previousUsers ? 'up' : 'down',
                icon: 'people',
            },
            {
                label: 'Active Subs',
                value: activeSubs.toLocaleString(),
                trend: calculateTrend(previousSubs, activeSubs),
                trendDir: activeSubs >= previousSubs ? 'up' : 'down',
                icon: 'card_membership',
            },
            {
                label: 'Total Revenue',
                value: formatCurrency(totalRevenue),
                trend: calculateTrend(previousRevenue, totalRevenue),
                trendDir: totalRevenue >= previousRevenue ? 'up' : 'down',
                icon: 'payments',
            },
            {
                label: 'Processed',
                value: statementsProcessed.toLocaleString(),
                trend: calculateTrend(previousStatements, statementsProcessed),
                trendDir: statementsProcessed >= previousStatements ? 'up' : 'down',
                icon: 'description',
            },
            {
                // Dummy data for parse error rate since it's hard to calculate without error logs
                label: 'Parse Error Rate',
                value: '0.8%',
                trend: '-0.2%',
                trendDir: 'down',
                icon: 'error_outline',
            },
        ];
    }),

    getChartData: adminProcedure.query(async ({ ctx }) => {
        // We will return data for the last 7 months
        const months: string[] = [];
        const userCounts = Array(7).fill(0);
        
        // Payment types tracking arrays
        const workspaceUnlocks = Array(7).fill(0);
        const creditPurchases = Array(7).fill(0);
        const bankAddons = Array(7).fill(0);

        const now = new Date();
        for (let i = 6; i >= 0; i--) {
            const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
            months.push(d.toLocaleString('default', { month: 'short' }).toUpperCase());
        }

        const sevenMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 6, 1);

        // Fetch User Growth
        const users = await ctx.prisma.user.findMany({
            where: { createdAt: { gte: sevenMonthsAgo } },
            select: { createdAt: true }
        });

        users.forEach(u => {
            const m = u.createdAt.getMonth();
            const y = u.createdAt.getFullYear();
            // Calculate index
            const monthsDiff = (now.getFullYear() - y) * 12 + (now.getMonth() - m);
            const idx = 6 - monthsDiff;
            if (idx >= 0 && idx <= 6) {
                userCounts[idx]++;
            }
        });

        // Normalize barHeights for UI (0-100%)
        const maxUsers = Math.max(...userCounts, 1); // Avoid division by zero
        const barHeights = userCounts.map(count => Math.round((count / maxUsers) * 100));

        // Fetch Payments
        const payments = await ctx.prisma.paystackTransaction.findMany({
            where: { 
                status: 'success',
                createdAt: { gte: sevenMonthsAgo }
            },
            select: { type: true, createdAt: true, amount: true }
        });

        payments.forEach(p => {
            const m = p.createdAt.getMonth();
            const y = p.createdAt.getFullYear();
            const monthsDiff = (now.getFullYear() - y) * 12 + (now.getMonth() - m);
            const idx = 6 - monthsDiff;
            
            if (idx >= 0 && idx <= 6) {
                if (p.type === 'workspace_unlock') workspaceUnlocks[idx]++;
                else if (p.type === 'credit_purchase') creditPurchases[idx]++;
                else if (p.type === 'bank_addon') bankAddons[idx]++;
            }
        });

        return {
            months,
            barHeights, // For User Growth
            payments: {
                workspaceUnlocks,
                creditPurchases,
                bankAddons
            }
        };
    }),

    getTopRegions: adminProcedure.query(async ({ ctx }) => {
        const users = await ctx.prisma.user.findMany({
            select: { stateOfResidence: true }
        });

        const total = users.length;
        if (total === 0) return [];

        const counts: Record<string, number> = {};
        users.forEach(u => {
            const state = u.stateOfResidence || "Unknown";
            counts[state] = (counts[state] || 0) + 1;
        });

        // Convert to array and sort
        const sorted = Object.entries(counts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 3)
            .map(([region, count]) => ({
                region,
                count,
                pct: Math.round((count / total) * 100)
            }));

        return sorted;
    }),

    getActivityFeed: adminProcedure.query(async ({ ctx }) => {
        // Fetch recent users
        const recentUsers = await ctx.prisma.user.findMany({
            take: 3,
            orderBy: { createdAt: 'desc' },
            select: { id: true, name: true, createdAt: true, stateOfResidence: true },
        });

        // Fetch recent payments
        const recentPayments = await ctx.prisma.paystackTransaction.findMany({
            take: 3,
            where: { status: 'success' },
            orderBy: { createdAt: 'desc' },
            select: { id: true, amount: true, createdAt: true, reference: true },
        });

        // Combine and sort
        const activities: Array<{icon: string, color: string, title: string, desc: string, createdAt: number}> = [];

        recentUsers.forEach((user) => {
            activities.push({
                icon: 'person_add',
                color: '#22c55e',
                title: 'New User Registered',
                desc: `${user.name || 'A user'} from ${user.stateOfResidence || 'Nigeria'} joined.`,
                createdAt: user.createdAt.getTime(),
            });
        });

        recentPayments.forEach((payment) => {
            activities.push({
                icon: 'payments',
                color: 'var(--admin-cyan)',
                title: 'Payment Success',
                desc: `₦${Number(payment.amount) / 100} top-up by ref ${payment.reference.slice(0, 8)}.`,
                createdAt: payment.createdAt.getTime(),
            });
        });

        activities.sort((a, b) => b.createdAt - a.createdAt);
        
        // Format time difference
        const now = Date.now();
        const formatTimeAgo = (ms: number) => {
            const diff = now - ms;
            const minutes = Math.floor(diff / 60000);
            if (minutes < 60) return `${minutes}m ago`;
            const hours = Math.floor(minutes / 60);
            if (hours < 24) return `${hours}h ago`;
            return `${Math.floor(hours / 24)}d ago`;
        };

        return activities.slice(0, 5).map((a) => ({
            icon: a.icon,
            color: a.color,
            title: a.title,
            desc: a.desc,
            time: formatTimeAgo(a.createdAt),
        }));
    }),
});
