import { adminProcedure, operationsProcedure, superAdminProcedure, router } from '../../trpc/trpc.js';
import { z } from 'zod';
import { sendBroadcastEmail } from '../../lib/mail.js';

const OPEN_TICKET_STATUSES = ['OPEN', 'IN_PROGRESS', 'AWAITING_USER'] as const;

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
                        select: {
                            workspaces: {
                                where: { isUnlocked: true, deletedAt: null }
                            }
                        }
                    }
                }
            });

            const openTicketCounts = items.length > 0
                ? await ctx.prisma.supportTicket.groupBy({
                    by: ['userId'],
                    where: {
                        userId: { in: items.map((item) => item.id) },
                        status: { in: [...OPEN_TICKET_STATUSES] },
                    },
                    _count: { _all: true },
                })
                : [];

            const openTicketCountByUserId = new Map(
                openTicketCounts.map((entry) => [entry.userId, entry._count._all])
            );

            let nextCursor: typeof cursor | undefined = undefined;
            if (items.length > limit) {
                const nextItem = items.pop();
                nextCursor = nextItem!.id;
            }

            return {
                items: items.map((item) => ({
                    ...item,
                    openTicketCount: openTicketCountByUserId.get(item.id) || 0,
                })),
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
            const openTicketCount = supportTickets.filter((ticket) =>
                OPEN_TICKET_STATUSES.includes(ticket.status as typeof OPEN_TICKET_STATUSES[number])
            ).length;

            const paystackTransactions = await ctx.prisma.paystackTransaction.findMany({
                where: { userId: input.id },
                orderBy: { createdAt: 'desc' }
            });

            // Calculate overall totals
            const totalSpent = paystackTransactions
                .filter(tx => tx.status === 'success')
                .reduce((acc, tx) => acc + (Number(tx.amount) / 100), 0);

            const totalCredits = user.workspaces
                .reduce((acc, ws) => acc + ws.statementCredits, 0);

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
                totalSpent,
                totalCredits,
                openTicketCount,
                transactions: paystackTransactions.map(tx => ({
                    id: tx.id,
                    reference: tx.reference,
                    amount: Number(tx.amount) / 100, // convert kobo to NGN
                    currency: tx.currency,
                    status: tx.status,
                    type: tx.type,
                    createdAt: tx.createdAt.toISOString()
                })),
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
                    statementCredits: ws.statementCredits,
                    reportGenerationCount: ws.reportGenerationCount,
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

    getUserMessageLog: adminProcedure
        .input(z.object({
            userId: z.string(),
            limit: z.number().min(1).max(100).default(100),
        }))
        .query(async ({ ctx, input }) => {
            const directMessageModel = (ctx.prisma as any).directMessage;
            const [directMessages, broadcastMessages] = await Promise.all([
                directMessageModel.findMany({
                    where: { userId: input.userId },
                    orderBy: { createdAt: 'desc' },
                    take: input.limit,
                    include: {
                        admin: {
                            select: { id: true, fullName: true, email: true },
                        },
                    },
                }),
                ctx.prisma.broadcastRecipient.findMany({
                    where: { userId: input.userId },
                    orderBy: { createdAt: 'desc' },
                    take: input.limit,
                    include: {
                        broadcast: {
                            include: {
                                createdBy: {
                                    select: { id: true, fullName: true, email: true },
                                },
                            },
                        },
                    },
                }),
            ]);

            return [
                ...directMessages.map((message: any) => ({
                    id: `direct:${message.id}`,
                    sourceId: message.id,
                    category: 'DIRECT' as const,
                    subject: message.subject,
                    body: message.body,
                    channel: 'EMAIL',
                    deliveryStatus: message.deliveryStatus,
                    resendEmailId: message.resendEmailId,
                    lastEventType: message.lastEventType,
                    lastEventAt: message.lastEventAt?.toISOString() ?? null,
                    deliveredAt: message.deliveredAt?.toISOString() ?? null,
                    openedAt: message.openedAt?.toISOString() ?? null,
                    failedAt: message.failedAt?.toISOString() ?? null,
                    failReason: message.failReason,
                    createdAt: message.createdAt.toISOString(),
                    createdBy: {
                        id: message.admin.id,
                        name: message.admin.fullName,
                        email: message.admin.email,
                    },
                })),
                ...broadcastMessages.map((message: any) => ({
                    id: `broadcast:${message.id}`,
                    sourceId: message.broadcastId,
                    category: 'BROADCAST' as const,
                    subject: message.broadcast.subject,
                    body: message.broadcast.body,
                    channel: message.channel,
                    deliveryStatus: message.deliveryStatus,
                    resendEmailId: message.resendEmailId,
                    lastEventType: message.lastEventType,
                    lastEventAt: message.lastEventAt?.toISOString() ?? null,
                    deliveredAt: message.deliveredAt?.toISOString() ?? null,
                    openedAt: message.openedAt?.toISOString() ?? null,
                    failedAt: message.failedAt?.toISOString() ?? null,
                    failReason: message.failReason,
                    createdAt: message.createdAt.toISOString(),
                    createdBy: {
                        id: message.broadcast.createdBy.id,
                        name: message.broadcast.createdBy.fullName,
                        email: message.broadcast.createdBy.email,
                    },
                })),
            ]
                .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
                .slice(0, input.limit);
        }),

    revealEmail: operationsProcedure
        .input(z.object({ userId: z.string() }))
        .mutation(async ({ ctx, input }) => {
            const user = await ctx.prisma.user.findUnique({
                where: { id: input.userId },
                select: { email: true, name: true }
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
                    targetEntity: `User:${user.name || 'Unknown'} (${user.email})`,
                    metadata: { reason: "Admin requested unmasked email" },
                }
            });

            return { email: user.email };
        }),

    sendMessage: adminProcedure
        .input(z.object({
            userId: z.string(),
            subject: z.string().min(1),
            body: z.string().min(1)
        }))
        .mutation(async ({ ctx, input }) => {
            const user = await ctx.prisma.user.findUnique({
                where: { id: input.userId },
                select: { id: true, email: true, name: true }
            });
            if (!user) throw new Error("User not found");

            const directMessageModel = (ctx.prisma as any).directMessage;

            const directMessage = await directMessageModel.create({
                data: {
                    userId: user.id,
                    adminId: ctx.admin.id,
                    subject: input.subject,
                    body: input.body,
                    deliveryStatus: 'PENDING',
                }
            });

            try {
                const result = await sendBroadcastEmail({
                    email: user.email,
                    name: user.name || '',
                    subject: input.subject,
                    body: input.body,
                    tags: [
                        { name: 'message_type', value: 'direct' },
                        { name: 'user_id', value: user.id },
                        { name: 'direct_message_id', value: directMessage.id },
                    ],
                });

                await directMessageModel.update({
                    where: { id: directMessage.id },
                    data: {
                        resendEmailId: result.providerMessageId,
                        deliveryStatus: 'SENT',
                        lastEventType: 'email.sent',
                        lastEventAt: new Date(),
                    }
                });
            } catch (error) {
                await directMessageModel.update({
                    where: { id: directMessage.id },
                    data: {
                        deliveryStatus: 'FAILED',
                        failedAt: new Date(),
                        lastEventType: 'email.failed',
                        lastEventAt: new Date(),
                        failReason: error instanceof Error ? error.message : String(error),
                    }
                });

                throw error;
            }

            // Create notification
            await ctx.prisma.notification.create({
                data: {
                    userId: user.id,
                    title: input.subject,
                    message: input.body.replace(/<[^>]*>/g, '').slice(0, 200),
                    type: 'INFO'
                }
            });

            // Audit
            await ctx.prisma.adminAuditLog.create({
                data: {
                    adminId: ctx.admin.id,
                    adminEmail: ctx.admin.email,
                    adminRole: ctx.admin.role,
                    actionCode: 'USER_MESSAGE_SENT',
                    targetEntity: `User:${user.name || 'Unknown'} (${user.email})`,
                    metadata: { subject: input.subject, directMessageId: directMessage.id }
                }
            });

            return { success: true, directMessageId: directMessage.id };
        }),

    giftCredit: operationsProcedure
        .input(z.object({
            userId: z.string(),
            workspaceId: z.string(),
            credits: z.number().min(1)
        }))
        .mutation(async ({ ctx, input }) => {
            const user = await ctx.prisma.user.findUnique({
                where: { id: input.userId },
                select: { id: true, email: true, name: true }
            });
            if (!user) throw new Error("User not found");

            const workspace = await ctx.prisma.workspace.findUnique({
                where: { id: input.workspaceId }
            });
            if (!workspace || workspace.userId !== user.id) throw new Error("Workspace not found");

            // Add credits
            await ctx.prisma.workspace.update({
                where: { id: workspace.id },
                data: { statementCredits: { increment: input.credits } }
            });

            // Notify User
            await sendBroadcastEmail({
                email: user.email,
                name: user.name || '',
                subject: "You've been gifted credits!",
                body: `Great news! The admin has gifted you ${input.credits} credit(s) for your ${workspace.taxYear} tax year workspace. Enjoy the platform!`
            });

            // In-app Notification
            await ctx.prisma.notification.create({
                data: {
                    userId: user.id,
                    title: "Credits Gifted",
                    message: `You've been gifted ${input.credits} credit(s) for Tax Year ${workspace.taxYear} by the admin!`,
                    type: 'SUCCESS'
                }
            });

            // Audit
            await ctx.prisma.adminAuditLog.create({
                data: {
                    adminId: ctx.admin.id,
                    adminEmail: ctx.admin.email,
                    adminRole: ctx.admin.role,
                    actionCode: 'CREDITS_GIFTED',
                    targetEntity: `User:${user.name || 'Unknown'} (${user.email})`,
                    metadata: { credits: input.credits, workspaceId: workspace.id, taxYear: workspace.taxYear }
                }
            });

            return { success: true };
        }),

    suspendUser: superAdminProcedure
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
                    targetEntity: `User:${updated.name || 'Unknown'} (${updated.email})`,
                }
            });

            if (updated.email) {
                await sendBroadcastEmail({
                    email: updated.email,
                    name: updated.name || "User",
                    subject: "Your account has been suspended",
                    body: "<p>We are writing to inform you that your account has been suspended.</p><p>If you have any questions or believe this was a mistake, please reach out to the administrator concerning the action by replying to this email.</p>"
                }).catch(err => console.error("Failed to send suspension email:", err));
            }

            return updated;
        }),

    unsuspendUser: superAdminProcedure
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
                    targetEntity: `User:${updated.name || 'Unknown'} (${updated.email})`,
                }
            });

            return updated;
        }),

    deleteUser: superAdminProcedure
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
                    targetEntity: `User:${updated.name || 'Unknown'} (${updated.email})`,
                }
            });

            if (updated.email) {
                await sendBroadcastEmail({
                    email: updated.email,
                    name: updated.name || "User",
                    subject: "Your account has been deleted",
                    body: "<p>We are writing to inform you that your account and associated data have been deleted.</p><p>If you have any questions, please reach out to the administrator concerning the action by replying to this email.</p>"
                }).catch(err => console.error("Failed to send deletion email:", err));
            }

            return { success: true };
        }),

    forceLogout: superAdminProcedure
        .input(z.object({ userId: z.string() }))
        .mutation(async ({ ctx, input }) => {
            await ctx.prisma.session.deleteMany({
                where: { userId: input.userId }
            });

            const updated = await ctx.prisma.user.update({
                where: { id: input.userId },
                data: { forceLogoutAt: new Date() }
            });

            await ctx.prisma.adminAuditLog.create({
                data: {
                    adminId: ctx.admin.id,
                    adminEmail: ctx.admin.email,
                    adminRole: ctx.admin.role,
                    actionCode: 'USER_FORCE_LOGOUT',
                    targetEntity: `User:${updated.name || 'Unknown'} (${updated.email})`,
                }
            });

            return { success: true };
        }),

    createUser: superAdminProcedure
        .input(z.object({
            name: z.string().min(1),
            email: z.string().email(),
            plan: z.enum(['FREE', 'PRO']).default('FREE'),
        }))
        .mutation(async ({ ctx, input }) => {
            const existing = await ctx.prisma.user.findUnique({ where: { email: input.email } });
            if (existing) throw new Error("User with this email already exists");

            // Create a random temporary password
            const bcrypt = await import('bcryptjs');
            const tempPassword = Math.random().toString(36).slice(-10);
            const passwordHash = await bcrypt.hash(tempPassword, 10);

            const user = await ctx.prisma.user.create({
                data: {
                    name: input.name,
                    email: input.email,
                    password: passwordHash,
                    plan: input.plan
                }
            });

            // Audit log
            await ctx.prisma.adminAuditLog.create({
                data: {
                    adminId: ctx.admin.id,
                    adminEmail: ctx.admin.email,
                    adminRole: ctx.admin.role,
                    actionCode: 'USER_CREATED',
                    targetEntity: `User:${user.name || 'Unknown'} (${user.email})`,
                    metadata: { email: user.email, plan: user.plan }
                }
            });

            return { success: true, tempPassword, user };
        }),
});
