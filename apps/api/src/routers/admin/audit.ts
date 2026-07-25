import { router, adminProcedure, protectedProcedure } from '../../trpc/trpc.js';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';

export const adminAuditRouter = router({
    listLogs: adminProcedure
        .input(
            z.object({
                limit: z.number().min(1).max(100).default(50),
                cursor: z.string().nullish(), // Log ID
                actionCode: z.string().optional(),
                adminId: z.string().optional(),
                search: z.string().optional(), // search in targetEntity or adminEmail
                startDate: z.string().optional(),
                endDate: z.string().optional(),
            })
        )
        .query(async ({ ctx, input }) => {
            const { limit, cursor, actionCode, adminId, search, startDate, endDate } = input;
            
            const where: any = {};
            
            if (actionCode && actionCode !== 'ALL') {
                where.actionCode = actionCode;
            }
            if (adminId && adminId !== 'ALL') {
                where.adminId = adminId;
            }
            if (search) {
                where.OR = [
                    { targetEntity: { contains: search, mode: 'insensitive' } },
                    { adminEmail: { contains: search, mode: 'insensitive' } },
                ];
            }
            if (startDate || endDate) {
                where.createdAt = {};
                if (startDate) where.createdAt.gte = new Date(startDate);
                if (endDate) {
                    const end = new Date(endDate);
                    end.setHours(23, 59, 59, 999);
                    where.createdAt.lte = end;
                }
            }

            const items = await ctx.prisma.adminAuditLog.findMany({
                take: limit + 1,
                where,
                orderBy: { createdAt: 'desc' },
                cursor: cursor ? { id: cursor } : undefined,
                include: {
                    admin: { select: { fullName: true } }
                }
            });

            let nextCursor: typeof cursor | undefined = undefined;
            if (items.length > limit) {
                const nextItem = items.pop();
                nextCursor = nextItem!.id;
            }

            return {
                items,
                nextCursor,
            };
        }),

    // ─── List User Activity Logs ────────────────────────────
    listUserLogs: adminProcedure
        .input(
            z.object({
                limit: z.number().min(1).max(100).default(50),
                cursor: z.string().optional(),
                userId: z.string().optional(),
                actionCode: z.string().optional(),
                search: z.string().optional(),
            })
        )
        .query(async ({ ctx, input }) => {
            if (ctx.admin.role !== 'SUPER_ADMIN' && ctx.admin.role !== 'OPERATIONS_ADMIN') {
                throw new TRPCError({ code: 'FORBIDDEN', message: 'Insufficient permissions' });
            }

            const { limit, cursor, userId, actionCode, search } = input;

            const where: any = {};
            if (userId && userId !== 'ALL') {
                where.userId = userId;
            }
            if (actionCode && actionCode !== 'ALL') {
                where.action = actionCode;
            }
            if (search) {
                where.OR = [
                    { entityType: { contains: search, mode: 'insensitive' } },
                    { user: { email: { contains: search, mode: 'insensitive' } } },
                ];
            }

            const items = await ctx.prisma.auditLog.findMany({
                take: limit + 1,
                cursor: cursor ? { id: cursor } : undefined,
                where,
                orderBy: { createdAt: 'desc' },
                include: {
                    user: {
                        select: { name: true, email: true }
                    }
                }
            });

            let nextCursor: typeof cursor | undefined = undefined;
            if (items.length > limit) {
                const nextItem = items.pop();
                nextCursor = nextItem!.id;
            }

            return { items, nextCursor };
        }),

    exportLogs: adminProcedure
        .input(
            z.object({
                format: z.enum(['csv', 'json']),
                actionCode: z.string().optional(),
                startDate: z.string().optional(),
                endDate: z.string().optional(),
            })
        )
        .mutation(async ({ ctx, input }) => {
            // Note: In a real app, you would generate a file and return a signed URL.
            // For MVP, we'll fetch up to 1000 records and return them directly as stringified data.
            const { actionCode, startDate, endDate, format } = input;
            
            const where: any = {};
            if (actionCode && actionCode !== 'ALL') where.actionCode = actionCode;
            if (startDate) where.createdAt = { gte: new Date(startDate) };
            if (endDate) {
                const end = new Date(endDate);
                end.setHours(23, 59, 59, 999);
                where.createdAt = { ...where.createdAt, lte: end };
            }

            const logs = await ctx.prisma.adminAuditLog.findMany({
                take: 1000,
                where,
                orderBy: { createdAt: 'desc' },
                include: { admin: { select: { fullName: true } } }
            });

            // Log the export action itself recursively
            await ctx.prisma.adminAuditLog.create({
                data: {
                    adminId: ctx.admin.id,
                    adminEmail: ctx.admin.email,
                    adminRole: ctx.admin.role,
                    actionCode: 'AUDIT_EXPORT',
                    metadata: { format, count: logs.length },
                }
            });

            if (format === 'json') {
                return { data: JSON.stringify(logs, null, 2), mimeType: 'application/json', extension: 'json' };
            }

            // Simple CSV generation
            const headers = ['Timestamp', 'ID', 'Admin Email', 'Role', 'Action', 'Target', 'IP Address'];
            const rows = logs.map((l: any) => [
                l.createdAt.toISOString(),
                l.id,
                l.adminEmail || 'System',
                l.adminRole || 'SYSTEM',
                l.actionCode,
                l.targetEntity || '',
                l.ipAddress || ''
            ]);
            
            const csvContent = [
                headers.join(','),
                ...rows.map((row: any[]) => row.map((cell: any) => `"${(cell || '').replace(/"/g, '""')}"`).join(','))
            ].join('\n');

            return { data: csvContent, mimeType: 'text/csv', extension: 'csv' };
        }),
});
