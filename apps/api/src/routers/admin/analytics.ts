import { adminProcedure, router } from '../../trpc/trpc.js';
import { z } from 'zod';

export const adminAnalyticsRouter = router({
    getReportData: adminProcedure
        .input(
            z.object({
                reportType: z.enum([
                    'USER_GROWTH',
                    'SUBSCRIPTION_MRR',
                    'PROCESSING_VOLUME',
                    'TAX_YEAR_ACTIVITY',
                    'SUPPORT_PERFORMANCE',
                    'BROADCAST_ENGAGEMENT',
                    'PLATFORM_HEALTH'
                ]),
                startDate: z.string(),
                endDate: z.string(),
            })
        )
        .query(async ({ ctx, input }) => {
            // In a real implementation, you'd aggregate based on the date range and type.
            // For MVP, we'll return robust mocked data sequences for the charts/tables.
            const dataPoints = [];
            const start = new Date(input.startDate);
            const end = new Date(input.endDate);
            let current = new Date(start);

            while (current <= end) {
                dataPoints.push({
                    date: current.toISOString().slice(0, 10),
                    value: Math.floor(Math.random() * 100) + 10,
                    secondary: Math.floor(Math.random() * 50) + 5
                });
                current.setDate(current.getDate() + 1);
            }

            // Also return some summary metrics
            return {
                points: dataPoints,
                summary: {
                    total: dataPoints.reduce((acc, p) => acc + p.value, 0),
                    average: Math.round(dataPoints.reduce((acc, p) => acc + p.value, 0) / dataPoints.length),
                    trend: '+12.5%'
                }
            };
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
            // Mock scheduling since there's no ScheduledReport model yet
            await ctx.prisma.adminAuditLog.create({
                data: {
                    adminId: ctx.admin.id,
                    adminEmail: ctx.admin.email,
                    adminRole: ctx.admin.role,
                    actionCode: 'REPORT_SCHEDULED',
                    metadata: { type: input.reportType, freq: input.frequency, to: input.recipients }
                }
            });
            return { success: true, dummyId: `sched_${Date.now()}` };
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
            // Return dummy file buffer data
            await ctx.prisma.adminAuditLog.create({
                data: {
                    adminId: ctx.admin.id,
                    adminEmail: ctx.admin.email,
                    adminRole: ctx.admin.role,
                    actionCode: 'REPORT_EXPORTED',
                    metadata: { type: input.reportType, format: input.format }
                }
            });
            
            return {
                dataUrl: `data:text/csv;charset=utf-8,Mock,Data\n1,2`,
                filename: `TaxEase_Report_${input.reportType}_${new Date().getTime()}.${input.format}`
            };
        }),
});
