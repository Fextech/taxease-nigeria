import { adminProcedure, router } from '../../trpc/trpc.js';
import { z } from 'zod';

export const adminUsersRouter = router({
    listUsers: adminProcedure
        .input(
            z.object({
                limit: z.number().min(1).max(100).default(20),
                cursor: z.string().nullish(), // User ID
                search: z.string().optional(),
                plan: z.string().optional(),
                status: z.string().optional(),
                sort: z.enum(['dateJoinedDesc', 'dateJoinedAsc', 'nameAsc', 'nameDesc']).default('dateJoinedDesc'),
            })
        )
        .query(async ({ ctx, input }) => {
            const { limit, cursor, search, plan, status, sort } = input;
            
            // Build WHERE clause
            const where: any = {};
            if (search) {
                where.OR = [
                    { name: { contains: search, mode: 'insensitive' } },
                    { email: { contains: search, mode: 'insensitive' } },
                    { id: { contains: search } },
                ];
            }
            if (plan && plan !== 'All') {
                where.plan = plan; // UserPlan enum
            }
            if (status === 'Active') {
                where.isSuspended = false;
                where.deletedAt = null;
            } else if (status === 'Suspended') {
                where.isSuspended = true;
            } else if (status === 'Deleted') {
                where.deletedAt = { not: null };
            } else {
                where.deletedAt = null; // Default: hide deleted
            }

            // Build ORDER BY
            let orderBy: any = { createdAt: 'desc' };
            if (sort === 'dateJoinedAsc') orderBy = { createdAt: 'asc' };
            if (sort === 'dateJoinedDesc') orderBy = { createdAt: 'desc' };
            if (sort === 'nameAsc') orderBy = { name: 'asc' };
            if (sort === 'nameDesc') orderBy = { name: 'desc' };

            const items = await ctx.prisma.user.findMany({
                take: limit + 1,
                where,
                orderBy,
                cursor: cursor ? { id: cursor } : undefined,
                select: {
                    id: true,
                    name: true,
                    email: true,
                    plan: true,
                    isSuspended: true,
                    createdAt: true,
                    _count: {
                        select: { workspaces: true }
                    }
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

    getUserDetails: adminProcedure
        .input(z.object({ id: z.string() }))
        .query(async ({ ctx, input }) => {
            const user = await ctx.prisma.user.findUnique({
                where: { id: input.id },
                include: {
                    workspaces: {
                        include: {
                            statements: {
                                take: 5,
                                orderBy: { createdAt: 'desc' },
                                select: {
                                    id: true,
                                    month: true,
                                    bankName: true,
                                    parseStatus: true,
                                    createdAt: true,
                                }
                            }
                        }
                    },
                    subscription: true,
                    accounts: {
                        select: {
                            id: true,
                            provider: true,
                            providerAccountId: true,
                            type: true,
                        }
                    },
                }
            });

            if (!user) {
                throw new Error("User not found");
            }

            // Mask email by default
            const maskedEmail = user.email.replace(/(?<=.).(?=[^@]*?.@)/g, '*');

            const supportTickets = await ctx.prisma.supportTicket.findMany({
                where: { userId: input.id },
                orderBy: { createdAt: 'desc' }
            });

            // Convert all dates to ISO strings so they serialise cleanly
            return {
                id: user.id,
                name: user.name,
                email: maskedEmail,
                phone: user.phone,
                plan: user.plan,
                isSuspended: user.isSuspended,
                mfaEnabled: user.mfaEnabled,
                taxIdentificationNumber: user.taxIdentificationNumber,
                stateOfResidence: user.stateOfResidence,
                createdAt: user.createdAt.toISOString(),
                updatedAt: user.updatedAt.toISOString(),
                deletedAt: user.deletedAt?.toISOString() ?? null,
                supportTickets: supportTickets.map((t) => ({
                    id: t.id,
                    subject: t.subject,
                    category: t.category,
                    status: t.status,
                    priority: t.priority,
                    createdAt: t.createdAt.toISOString(),
                })),
                subscription: user.subscription ? {
                    id: user.subscription.id,
                    plan: user.subscription.plan,
                    status: user.subscription.status,
                    billingCycleStart: user.subscription.billingCycleStart?.toISOString() ?? null,
                    billingCycleEnd: user.subscription.billingCycleEnd?.toISOString() ?? null,
                    createdAt: user.subscription.createdAt.toISOString(),
                } : null,
                accounts: user.accounts.map((a) => ({
                    id: a.id,
                    provider: a.provider,
                    type: a.type,
                })),
                workspaces: user.workspaces.map((ws) => ({
                    id: ws.id,
                    taxYear: ws.taxYear,
                    status: ws.status,
                    isUnlocked: ws.isUnlocked,
                    createdAt: ws.createdAt.toISOString(),
                    statements: ws.statements.map((s) => ({
                        id: s.id,
                        month: s.month,
                        parseStatus: s.parseStatus,
                        bankName: s.bankName,
                        createdAt: s.createdAt.toISOString(),
                    })),
                })),
            };
        }),

    revealEmail: adminProcedure
        .input(z.object({ userId: z.string() }))
        .mutation(async ({ ctx, input }) => {
            const user = await ctx.prisma.user.findUnique({
                where: { id: input.userId },
                select: { email: true }
            });

            if (!user) {
                throw new Error("User not found");
            }

            // Audit log this sensitive action
            await ctx.prisma.adminAuditLog.create({
                data: {
                    adminId: ctx.admin.id,
                    adminEmail: ctx.admin.email,
                    adminRole: ctx.admin.role,
                    actionCode: 'REVEAL_EMAIL',
                    targetEntity: `User:${input.userId}`,
                    metadata: { reason: "Admin requested unmasked email" },
                }
            });

            return { email: user.email };
        }),

    suspendUser: adminProcedure
        .input(z.object({ userId: z.string() }))
        .mutation(async ({ ctx, input }) => {
            const updated = await ctx.prisma.user.update({
                where: { id: input.userId },
                data: { isSuspended: true }
            });

            await ctx.prisma.adminAuditLog.create({
                data: {
                    adminId: ctx.admin.id,
                    adminEmail: ctx.admin.email,
                    adminRole: ctx.admin.role,
                    actionCode: 'USER_SUSPENDED',
                    targetEntity: `User:${input.userId}`,
                }
            });

            return updated;
        }),

    unsuspendUser: adminProcedure
        .input(z.object({ userId: z.string() }))
        .mutation(async ({ ctx, input }) => {
            const updated = await ctx.prisma.user.update({
                where: { id: input.userId },
                data: { isSuspended: false }
            });

            await ctx.prisma.adminAuditLog.create({
                data: {
                    adminId: ctx.admin.id,
                    adminEmail: ctx.admin.email,
                    adminRole: ctx.admin.role,
                    actionCode: 'USER_UNSUSPENDED',
                    targetEntity: `User:${input.userId}`,
                }
            });

            return updated;
        }),

    deleteUser: adminProcedure
        .input(z.object({ userId: z.string() }))
        .mutation(async ({ ctx, input }) => {
            const updated = await ctx.prisma.user.update({
                where: { id: input.userId },
                data: { deletedAt: new Date(), isSuspended: true }
            });

            await ctx.prisma.adminAuditLog.create({
                data: {
                    adminId: ctx.admin.id,
                    adminEmail: ctx.admin.email,
                    adminRole: ctx.admin.role,
                    actionCode: 'USER_DELETED',
                    targetEntity: `User:${input.userId}`,
                }
            });

            return { success: true };
        }),

    forceLogout: adminProcedure
        .input(z.object({ userId: z.string() }))
        .mutation(async ({ ctx, input }) => {
            await ctx.prisma.session.deleteMany({
                where: { userId: input.userId }
            });

            await ctx.prisma.adminAuditLog.create({
                data: {
                    adminId: ctx.admin.id,
                    adminEmail: ctx.admin.email,
                    adminRole: ctx.admin.role,
                    actionCode: 'USER_FORCE_LOGOUT',
                    targetEntity: `User:${input.userId}`,
                }
            });

            return { success: true };
        }),
});
