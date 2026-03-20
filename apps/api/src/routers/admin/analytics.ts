import { adminProcedure, router } from '../../trpc/trpc.js';
import { z } from 'zod';

const REPORT_TYPES = [
    'USER_GROWTH',
    'REVENUE_PAYMENTS',
    'PROCESSING_VOLUME',
    'SUPPORT_PERFORMANCE',
    'BROADCAST_ENGAGEMENT',
] as const;

// Helper: generate array of date strings between start and end
function getDateRange(start: Date, end: Date): string[] {
    const dates: string[] = [];
    const current = new Date(start);
    while (current <= end) {
        dates.push(current.toISOString().slice(0, 10));
        current.setDate(current.getDate() + 1);
    }
    return dates;
}

// Helper: bucket items by date string
function bucketByDate<T>(items: T[], dateExtractor: (item: T) => Date, dateRange: string[]): Record<string, T[]> {
    const buckets: Record<string, T[]> = {};
    dateRange.forEach(d => { buckets[d] = []; });
    items.forEach(item => {
        const key = dateExtractor(item).toISOString().slice(0, 10);
        if (buckets[key]) buckets[key].push(item);
    });
    return buckets;
}

export const adminAnalyticsRouter = router({
    getReportData: adminProcedure
        .input(
            z.object({
                reportType: z.enum(REPORT_TYPES),
                startDate: z.string(),
                endDate: z.string(),
            })
        )
        .query(async ({ ctx, input }) => {
            const startDate = new Date(input.startDate);
            const endDate = new Date(input.endDate);
            endDate.setHours(23, 59, 59, 999);
            const dateRange = getDateRange(startDate, endDate);

            switch (input.reportType) {
                // ─── User Growth ──────────────────────────────
                case 'USER_GROWTH': {
                    const users = await ctx.prisma.user.findMany({
                        where: { createdAt: { gte: startDate, lte: endDate } },
                        select: { createdAt: true },
                    });
                    const buckets = bucketByDate(users, u => u.createdAt, dateRange);
                    const points = dateRange.map(date => ({
                        date,
                        value: buckets[date].length,
                        secondary: 0,
                    }));
                    // Running cumulative for secondary
                    let cumulative = 0;
                    points.forEach(p => { cumulative += p.value; p.secondary = cumulative; });
                    const total = users.length;
                    const avg = dateRange.length > 0 ? Math.round(total / dateRange.length * 10) / 10 : 0;
                    const mid = Math.floor(dateRange.length / 2);
                    const firstHalf = points.slice(0, mid).reduce((s, p) => s + p.value, 0);
                    const secondHalf = points.slice(mid).reduce((s, p) => s + p.value, 0);
                    const trend = firstHalf === 0 ? (secondHalf > 0 ? '+100%' : '0%') : `${secondHalf >= firstHalf ? '+' : ''}${(((secondHalf - firstHalf) / firstHalf) * 100).toFixed(1)}%`;
                    return {
                        points,
                        summary: { total, average: avg, trend },
                        labels: { primary: 'New Users', secondary: 'Cumulative Total' },
                    };
                }

                // ─── Revenue & Payments ──────────────────────
                case 'REVENUE_PAYMENTS': {
                    const txns = await ctx.prisma.paystackTransaction.findMany({
                        where: { status: 'success', createdAt: { gte: startDate, lte: endDate } },
                        select: { createdAt: true, amount: true, type: true },
                    });
                    const buckets = bucketByDate(txns, t => t.createdAt, dateRange);
                    const points = dateRange.map(date => {
                        const dayTxns = buckets[date];
                        const revenue = dayTxns.reduce((s, t) => s + Number(t.amount), 0) / 100; // kobo -> NGN
                        return { date, value: Math.round(revenue), secondary: dayTxns.length };
                    });
                    const totalRevenue = points.reduce((s, p) => s + p.value, 0);
                    const totalCount = txns.length;
                    const avg = dateRange.length > 0 ? Math.round(totalRevenue / dateRange.length) : 0;
                    const mid = Math.floor(dateRange.length / 2);
                    const firstHalf = points.slice(0, mid).reduce((s, p) => s + p.value, 0);
                    const secondHalf = points.slice(mid).reduce((s, p) => s + p.value, 0);
                    const trend = firstHalf === 0 ? (secondHalf > 0 ? '+100%' : '0%') : `${secondHalf >= firstHalf ? '+' : ''}${(((secondHalf - firstHalf) / firstHalf) * 100).toFixed(1)}%`;
                    return {
                        points,
                        summary: { total: totalRevenue, average: avg, trend },
                        labels: { primary: 'Revenue (₦)', secondary: 'Transactions' },
                    };
                }

                // ─── Statement Processing Volume ─────────────
                case 'PROCESSING_VOLUME': {
                    const statements = await ctx.prisma.statement.findMany({
                        where: { createdAt: { gte: startDate, lte: endDate }, deletedAt: null },
                        select: { createdAt: true, parseStatus: true },
                    });
                    const buckets = bucketByDate(statements, s => s.createdAt, dateRange);
                    const points = dateRange.map(date => {
                        const dayStmts = buckets[date];
                        return {
                            date,
                            value: dayStmts.length,
                            secondary: dayStmts.filter(s => s.parseStatus === 'ERROR').length,
                        };
                    });
                    const total = statements.length;
                    const totalErrors = statements.filter(s => s.parseStatus === 'ERROR').length;
                    const avg = dateRange.length > 0 ? Math.round(total / dateRange.length * 10) / 10 : 0;
                    const errorRate = total > 0 ? `${((totalErrors / total) * 100).toFixed(1)}%` : '0%';
                    return {
                        points,
                        summary: { total, average: avg, trend: `${errorRate} error rate` },
                        labels: { primary: 'Statements Processed', secondary: 'Errors' },
                    };
                }

                // ─── Support Performance ─────────────────────
                case 'SUPPORT_PERFORMANCE': {
                    const tickets = await ctx.prisma.supportTicket.findMany({
                        where: { createdAt: { gte: startDate, lte: endDate } },
                        select: { createdAt: true, status: true, resolvedAt: true },
                    });
                    const buckets = bucketByDate(tickets, t => t.createdAt, dateRange);
                    const points = dateRange.map(date => {
                        const dayTickets = buckets[date];
                        return {
                            date,
                            value: dayTickets.length,
                            secondary: dayTickets.filter(t => t.status === 'RESOLVED' || t.status === 'CLOSED').length,
                        };
                    });
                    const total = tickets.length;
                    const resolved = tickets.filter(t => t.status === 'RESOLVED' || t.status === 'CLOSED').length;
                    const avg = dateRange.length > 0 ? Math.round(total / dateRange.length * 10) / 10 : 0;
                    const resRate = total > 0 ? `${((resolved / total) * 100).toFixed(1)}% resolved` : 'No tickets';
                    return {
                        points,
                        summary: { total, average: avg, trend: resRate },
                        labels: { primary: 'Tickets Opened', secondary: 'Resolved' },
                    };
                }

                // ─── Broadcast Engagement ────────────────────
                case 'BROADCAST_ENGAGEMENT': {
                    const broadcasts = await ctx.prisma.broadcast.findMany({
                        where: { status: 'SENT', sentAt: { gte: startDate, lte: endDate } },
                        select: { sentAt: true, totalRecipients: true, delivered: true, opened: true, failed: true },
                    });
                    const buckets = bucketByDate(broadcasts, b => b.sentAt!, dateRange);
                    const points = dateRange.map(date => {
                        const dayBroadcasts = buckets[date];
                        return {
                            date,
                            value: dayBroadcasts.reduce((s, b) => s + b.delivered, 0),
                            secondary: dayBroadcasts.reduce((s, b) => s + b.opened, 0),
                        };
                    });
                    const totalDelivered = broadcasts.reduce((s, b) => s + b.delivered, 0);
                    const totalOpened = broadcasts.reduce((s, b) => s + b.opened, 0);
                    const openRate = totalDelivered > 0 ? `${((totalOpened / totalDelivered) * 100).toFixed(1)}% open rate` : 'No data';
                    return {
                        points,
                        summary: { total: totalDelivered, average: broadcasts.length, trend: openRate },
                        labels: { primary: 'Delivered', secondary: 'Opened' },
                    };
                }

                default:
                    return { points: [], summary: { total: 0, average: 0, trend: '0%' }, labels: { primary: 'Value', secondary: 'Secondary' } };
            }
        }),

    scheduleReport: adminProcedure
        .input(
            z.object({
                reportType: z.string(),
                frequency: z.enum(['DAILY', 'WEEKLY', 'MONTHLY']),
                recipients: z.array(z.string().email()),
            })
        )
        .mutation(async ({ ctx, input }) => {
            // No cron infrastructure — log intent to audit trail
            await ctx.prisma.adminAuditLog.create({
                data: {
                    adminId: ctx.admin.id,
                    adminEmail: ctx.admin.email,
                    adminRole: ctx.admin.role,
                    actionCode: 'REPORT_SCHEDULED',
                    metadata: { type: input.reportType, freq: input.frequency, to: input.recipients }
                }
            });
            return { success: true, message: `Schedule logged. Automated delivery requires cron setup.` };
        }),

    exportReport: adminProcedure
        .input(
            z.object({
                reportType: z.string(),
                format: z.enum(['csv', 'pdf', 'excel']),
                startDate: z.string(),
                endDate: z.string(),
            })
        )
        .mutation(async ({ ctx, input }) => {
            // Re-use getReportData logic by calling the same aggregation
            const startDate = new Date(input.startDate);
            const endDate = new Date(input.endDate);
            endDate.setHours(23, 59, 59, 999);
            const dateRange = getDateRange(startDate, endDate);

            // Simplified: always query users as a fallback; real impl would switch like getReportData
            let rows: Array<{ date: string; value: number; secondary: number }> = [];
            let primaryLabel = 'Value';
            let secondaryLabel = 'Secondary';

            if (input.reportType === 'USER_GROWTH') {
                const users = await ctx.prisma.user.findMany({
                    where: { createdAt: { gte: startDate, lte: endDate } },
                    select: { createdAt: true },
                });
                const buckets = bucketByDate(users, u => u.createdAt, dateRange);
                rows = dateRange.map(date => ({ date, value: buckets[date].length, secondary: 0 }));
                let cum = 0; rows.forEach(r => { cum += r.value; r.secondary = cum; });
                primaryLabel = 'New Users'; secondaryLabel = 'Cumulative';
            } else if (input.reportType === 'REVENUE_PAYMENTS') {
                const txns = await ctx.prisma.paystackTransaction.findMany({
                    where: { status: 'success', createdAt: { gte: startDate, lte: endDate } },
                    select: { createdAt: true, amount: true },
                });
                const buckets = bucketByDate(txns, t => t.createdAt, dateRange);
                rows = dateRange.map(date => {
                    const dayTxns = buckets[date];
                    return { date, value: Math.round(dayTxns.reduce((s, t) => s + Number(t.amount), 0) / 100), secondary: dayTxns.length };
                });
                primaryLabel = 'Revenue (NGN)'; secondaryLabel = 'Transactions';
            } else if (input.reportType === 'PROCESSING_VOLUME') {
                const stmts = await ctx.prisma.statement.findMany({
                    where: { createdAt: { gte: startDate, lte: endDate }, deletedAt: null },
                    select: { createdAt: true, parseStatus: true },
                });
                const buckets = bucketByDate(stmts, s => s.createdAt, dateRange);
                rows = dateRange.map(date => ({ date, value: buckets[date].length, secondary: buckets[date].filter(s => s.parseStatus === 'ERROR').length }));
                primaryLabel = 'Processed'; secondaryLabel = 'Errors';
            } else if (input.reportType === 'SUPPORT_PERFORMANCE') {
                const tickets = await ctx.prisma.supportTicket.findMany({
                    where: { createdAt: { gte: startDate, lte: endDate } },
                    select: { createdAt: true, status: true },
                });
                const buckets = bucketByDate(tickets, t => t.createdAt, dateRange);
                rows = dateRange.map(date => ({ date, value: buckets[date].length, secondary: buckets[date].filter(t => t.status === 'RESOLVED' || t.status === 'CLOSED').length }));
                primaryLabel = 'Opened'; secondaryLabel = 'Resolved';
            } else if (input.reportType === 'BROADCAST_ENGAGEMENT') {
                const broadcasts = await ctx.prisma.broadcast.findMany({
                    where: { status: 'SENT', sentAt: { gte: startDate, lte: endDate } },
                    select: { sentAt: true, delivered: true, opened: true },
                });
                const buckets = bucketByDate(broadcasts, b => b.sentAt!, dateRange);
                rows = dateRange.map(date => ({ date, value: buckets[date].reduce((s, b) => s + b.delivered, 0), secondary: buckets[date].reduce((s, b) => s + b.opened, 0) }));
                primaryLabel = 'Delivered'; secondaryLabel = 'Opened';
            }

            // Build CSV
            const csvHeader = `Date,${primaryLabel},${secondaryLabel}`;
            const csvRows = rows.map(r => `${r.date},${r.value},${r.secondary}`);
            const csvContent = [csvHeader, ...csvRows].join('\n');
            const dataUrl = `data:text/csv;charset=utf-8,${encodeURIComponent(csvContent)}`;
            const filename = `BankLens_${input.reportType}_${input.startDate}_to_${input.endDate}.csv`;

            // Audit log
            await ctx.prisma.adminAuditLog.create({
                data: {
                    adminId: ctx.admin.id,
                    adminEmail: ctx.admin.email,
                    adminRole: ctx.admin.role,
                    actionCode: 'REPORT_EXPORTED',
                    metadata: { type: input.reportType, format: input.format, dateRange: `${input.startDate} - ${input.endDate}` }
                }
            });

            return { dataUrl, filename };
        }),
});
