import { adminProcedure, router } from "../../trpc/trpc.js";
import { z } from "zod";
import { sendSupportReplyEmail } from "../../lib/mail.js";

export const adminSupportRouter = router({
    getSupportStats: adminProcedure.query(async ({ ctx }) => {
        const [openCount, overdueCount, resolvedCount] = await Promise.all([
            ctx.prisma.supportTicket.count({ where: { status: 'OPEN' } }),
            ctx.prisma.supportTicket.count({ where: { 
                status: { notIn: ['RESOLVED', 'CLOSED'] },
                slaDeadline: { lt: new Date() }
            }}),
            ctx.prisma.supportTicket.count({ where: { status: 'RESOLVED' } }),
        ]);

        return {
            openCount,
            overdueCount,
            resolvedCount,
            avgResolutionTimeHours: 4.5, // Mocked for simplicity
        };
    }),

    listTickets: adminProcedure
        .input(
            z.object({
                limit: z.number().min(1).max(50).default(20),
                cursor: z.string().nullish(),
                filter: z.enum(['all', 'mine', 'overdue', 'resolved']).default('all'),
                priorities: z.array(z.string()).optional(),
                categories: z.array(z.string()).optional(),
            })
        )
        .query(async ({ ctx, input }) => {
            const { limit, cursor, filter, priorities, categories } = input;
            
            const where: any = {};
            
            if (filter === 'mine') {
                where.assigneeId = ctx.admin.id;
            } else if (filter === 'overdue') {
                where.status = { notIn: ['RESOLVED', 'CLOSED'] };
                where.slaDeadline = { lt: new Date() };
            } else if (filter === 'resolved') {
                where.status = 'RESOLVED';
            }
            
            if (priorities && priorities.length > 0) {
                where.priority = { in: priorities.map(p => p.toUpperCase()) };
            }
            
            if (categories && categories.length > 0) {
                where.category = { in: categories.map(c => c.toUpperCase().replace(' ', '_')) };
            }

            const items = await ctx.prisma.supportTicket.findMany({
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

            // Manually map users for names
            const userIds = [...new Set(items.map((i) => i.userId).filter((id): id is string => Boolean(id)))];
            const users = await ctx.prisma.user.findMany({
                where: { id: { in: userIds } },
                select: { id: true, name: true, email: true }
            });
            const userMap = new Map(users.map((u) => [u.id, u]));

            const enrichedItems = items.map((t) => ({
                ...t,
                user: userMap.get(t.userId) || { name: 'Unknown User' }
            }));

            return { items: enrichedItems, nextCursor };
        }),

    getTicketDetails: adminProcedure
        .input(z.object({ ticketId: z.string() }))
        .query(async ({ ctx, input }) => {
            const ticket = await ctx.prisma.supportTicket.findUnique({
                where: { id: input.ticketId },
                include: {
                    messages: {
                        orderBy: { createdAt: 'asc' },
                        include: { admin: { select: { fullName: true } } }
                    },
                    assignee: { select: { id: true, fullName: true, email: true } }
                }
            });

            if (!ticket) throw new Error('Ticket not found');

            const user = await ctx.prisma.user.findUnique({
                where: { id: ticket.userId },
                select: { id: true, name: true, email: true, workspaces: true, subscription: true, plan: true }
            });

            // Handle BigInt serialization for Workspace data
            const safeUser = user ? {
                ...user,
                workspaces: user.workspaces.map(w => ({
                    ...w,
                    totalIncome: w.totalIncome.toString(),
                    totalTaxableIncome: w.totalTaxableIncome.toString(),
                    totalTaxLiability: w.totalTaxLiability.toString(),
                    annualRentAmount: w.annualRentAmount ? w.annualRentAmount.toString() : null
                }))
            } : null;

            return { ticket, user: safeUser };
        }),
        
    replyToTicket: adminProcedure
        .input(z.object({
            ticketId: z.string(),
            body: z.string(),
            isInternal: z.boolean().default(false),
            markResolved: z.boolean().default(false)
        }))
        .mutation(async ({ ctx, input }) => {
            const msg = await ctx.prisma.supportMessage.create({
                data: {
                    ticketId: input.ticketId,
                    senderId: ctx.admin.id,
                    senderType: 'admin',
                    adminId: ctx.admin.id,
                    body: input.body,
                    isInternal: input.isInternal
                }
            });

            // Update ticket status
            if (input.markResolved) {
                await ctx.prisma.supportTicket.update({
                    where: { id: input.ticketId },
                    data: { status: 'RESOLVED', resolvedAt: new Date(), updatedAt: new Date() }
                });
            } else {
                await ctx.prisma.supportTicket.update({
                    where: { id: input.ticketId },
                    data: { status: 'AWAITING_USER', updatedAt: new Date() }
                });
            }

            // Send email to user for public (non-internal) replies
            if (!input.isInternal) {
                try {
                    const ticket = await ctx.prisma.supportTicket.findUnique({
                        where: { id: input.ticketId },
                        select: { subject: true, userId: true }
                    });
                    if (ticket) {
                        const user = await ctx.prisma.user.findUnique({
                            where: { id: ticket.userId },
                            select: { email: true, name: true }
                        });
                        if (user?.email) {
                            await sendSupportReplyEmail({
                                email: user.email,
                                name: user.name || "",
                                subject: ticket.subject,
                                ticketId: input.ticketId,
                                replyBody: input.body,
                            });
                        }
                    }
                } catch (emailErr) {
                    // Don't fail the reply if email sending fails — just log it
                    console.error('[Support] Failed to send reply email:', emailErr);
                }
            }

            return msg;
        }),
        
    updateTicketStatus: adminProcedure
        .input(z.object({
            ticketId: z.string(),
            status: z.enum(['OPEN', 'IN_PROGRESS', 'AWAITING_USER', 'RESOLVED', 'CLOSED'])
        }))
        .mutation(async ({ ctx, input }) => {
            return ctx.prisma.supportTicket.update({
                where: { id: input.ticketId },
                data: { 
                    status: input.status,
                    resolvedAt: input.status === 'RESOLVED' ? new Date() : undefined,
                    closedAt: input.status === 'CLOSED' ? new Date() : undefined
                }
            });
        }),

    assignTicket: adminProcedure
        .input(z.object({
            ticketId: z.string(),
            assigneeId: z.string().nullable() // null to unassign
        }))
        .mutation(async ({ ctx, input }) => {
            return ctx.prisma.supportTicket.update({
                where: { id: input.ticketId },
                data: { assigneeId: input.assigneeId }
            });
        })
});
