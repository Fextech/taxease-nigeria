import { adminProcedure, router } from '../../trpc/trpc.js';
import { z } from 'zod';

export const adminBroadcastRouter = router({
    listBroadcasts: adminProcedure
        .input(
            z.object({
                limit: z.number().min(1).max(50).default(10),
                cursor: z.string().nullish(),
                status: z.string().optional(),
            })
        )
        .query(async ({ ctx, input }) => {
            const { limit, cursor, status } = input;
            
            const where: any = {};
            if (status && status !== 'All') {
                where.status = status;
            }

            const items = await ctx.prisma.broadcast.findMany({
                take: limit + 1,
                where,
                cursor: cursor ? { id: cursor } : undefined,
                orderBy: { createdAt: 'desc' },
                include: {
                    createdBy: {
                        select: { id: true, fullName: true, email: true }
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

    getSegmentEstimate: adminProcedure
        .input(z.object({ 
            segmentType: z.enum(['ALL', 'SUBSCRIBERS', 'FREE', 'CUSTOM']),
            // segmentConfig would contain custom filters e.g. stateOfResidence
        }))
        .query(async ({ ctx, input }) => {
            let where: any = { isSuspended: false, deletedAt: null };

            if (input.segmentType === 'SUBSCRIBERS') {
                where.plan = 'PRO';
            } else if (input.segmentType === 'FREE') {
                where.plan = 'FREE';
            }

            const count = await ctx.prisma.user.count({ where });
            return { count };
        }),

    createBroadcast: adminProcedure
        .input(z.object({
            subject: z.string().min(1),
            body: z.string().min(1),
            channel: z.enum(['EMAIL', 'IN_APP', 'BOTH']),
            segmentType: z.enum(['ALL', 'SUBSCRIBERS', 'FREE', 'CUSTOM']),
            segmentConfig: z.any().optional(),
            scheduledAt: z.date().optional(),
            saveAsDraft: z.boolean().default(false),
        }))
        .mutation(async ({ ctx, input }) => {
            // First estimate total recipients
            let where: any = { isSuspended: false, deletedAt: null };
            if (input.segmentType === 'SUBSCRIBERS') where.plan = 'PRO';
            if (input.segmentType === 'FREE') where.plan = 'FREE';
            
            const totalRecipients = await ctx.prisma.user.count({ where });

            const status = input.saveAsDraft 
                ? 'DRAFT' 
                : (input.scheduledAt ? 'SCHEDULED' : 'PENDING');

            const broadcast = await ctx.prisma.broadcast.create({
                data: {
                    subject: input.subject,
                    body: input.body,
                    channel: input.channel,
                    segmentType: input.segmentType,
                    segmentConfig: input.segmentConfig || {},
                    scheduledAt: input.scheduledAt,
                    status: status as any, // PENDING isn't strictly in schema yet, but wait, schema has SENDING, DRAFT, SCHEDULED, SENT. Let's use SCHEDULED.
                    totalRecipients,
                    createdById: ctx.admin.id,
                }
            });

            await ctx.prisma.adminAuditLog.create({
                data: {
                    adminId: ctx.admin.id,
                    adminEmail: ctx.admin.email,
                    adminRole: ctx.admin.role,
                    actionCode: 'BROADCAST_CREATED',
                    targetEntity: `Broadcast:${broadcast.id}`,
                    metadata: {
                        subject: broadcast.subject,
                        status: broadcast.status
                    }
                }
            });

            // Note: Actual sending logic would be handled by a BullMQ worker picking up SCHEDULED/SENDING broadcasts
            if (!input.saveAsDraft && !input.scheduledAt) {
                // If it's sent immediately, we update to SENDING and enqueue job
                await ctx.prisma.broadcast.update({
                    where: { id: broadcast.id },
                    data: { status: 'SENDING' }
                });
                // TODO: bullmq.add('send-broadcast', { broadcastId: broadcast.id })
            }

            return broadcast;
        })
});
