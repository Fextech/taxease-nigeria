import { adminProcedure, operationsProcedure, router } from '../../trpc/trpc.js';
import { z } from 'zod';
import { PrismaClient } from '@prisma/client';
import { sendBroadcastEmail } from '../../lib/mail.js';

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

    getBroadcast: adminProcedure
        .input(z.object({ id: z.string() }))
        .query(async ({ ctx, input }) => {
            const broadcast = await ctx.prisma.broadcast.findUnique({
                where: { id: input.id },
                include: {
                    createdBy: { select: { id: true, fullName: true, email: true } },
                }
            });
            if (!broadcast) throw new Error('Broadcast not found');
            return broadcast;
        }),

    updateBroadcast: operationsProcedure
        .input(z.object({
            id: z.string(),
            subject: z.string().min(1).optional(),
            body: z.string().min(1).optional(),
            channel: z.enum(['EMAIL', 'IN_APP', 'BOTH']).optional(),
            segmentType: z.enum(['ALL', 'SUBSCRIBERS', 'FREE', 'CUSTOM']).optional(),
            taxYears: z.array(z.number()).optional(),
            scheduledAt: z.coerce.date().nullish(),
            sendNow: z.boolean().default(false),
        }))
        .mutation(async ({ ctx, input }) => {
            const existing = await ctx.prisma.broadcast.findUnique({ where: { id: input.id } });
            if (!existing) throw new Error('Broadcast not found');
            if (existing.status !== 'DRAFT' && existing.status !== 'SCHEDULED') {
                throw new Error('Only DRAFT or SCHEDULED broadcasts can be edited');
            }

            const segmentType = input.segmentType || existing.segmentType;
            const taxYears = input.taxYears ?? ((existing.segmentConfig as any)?.taxYears || []);
            const userIds = await resolveRecipients(ctx.prisma, segmentType, taxYears.length > 0 ? taxYears : undefined);

            let newStatus: string = existing.status;
            if (input.sendNow) {
                newStatus = 'SENDING';
            } else if (input.scheduledAt) {
                newStatus = 'SCHEDULED';
            }

            const broadcast = await ctx.prisma.broadcast.update({
                where: { id: input.id },
                data: {
                    ...(input.subject && { subject: input.subject }),
                    ...(input.body && { body: input.body }),
                    ...(input.channel && { channel: input.channel }),
                    ...(input.segmentType && { segmentType: input.segmentType }),
                    segmentConfig: { taxYears },
                    scheduledAt: input.scheduledAt === null ? null : (input.scheduledAt || existing.scheduledAt),
                    totalRecipients: userIds.length,
                    status: newStatus as any,
                }
            });

            // If sendNow, execute immediately
            if (input.sendNow) {
                executeBroadcastSend(ctx.prisma, broadcast.id, userIds, broadcast.channel, broadcast.subject, broadcast.body)
                    .catch(err => console.error('[Broadcast] Send failed:', err));
            }

            return broadcast;
        }),

    getSegmentEstimate: adminProcedure
        .input(z.object({ 
            segmentType: z.enum(['ALL', 'SUBSCRIBERS', 'FREE', 'CUSTOM']),
            taxYears: z.array(z.number()).optional(),
        }))
        .query(async ({ ctx, input }) => {
            const { segmentType, taxYears } = input;

            if (segmentType === 'SUBSCRIBERS') {
                const workspaceFilter: any = { isUnlocked: true, deletedAt: null };
                if (taxYears && taxYears.length > 0) {
                    workspaceFilter.taxYear = { in: taxYears };
                }

                const users = await ctx.prisma.user.findMany({
                    where: {
                        isSuspended: false,
                        deletedAt: null,
                        workspaces: { some: workspaceFilter }
                    },
                    select: { id: true }
                });
                return { count: users.length };
            }

            if (segmentType === 'FREE') {
                const workspaceFilter: any = { isUnlocked: true, deletedAt: null };
                if (taxYears && taxYears.length > 0) {
                    workspaceFilter.taxYear = { in: taxYears };
                }

                const users = await ctx.prisma.user.findMany({
                    where: {
                        isSuspended: false,
                        deletedAt: null,
                        workspaces: { none: workspaceFilter },
                        ...(taxYears && taxYears.length > 0
                            ? { workspaces: { some: { taxYear: { in: taxYears }, deletedAt: null } } }
                            : {}
                        )
                    },
                    select: { id: true }
                });
                return { count: users.length };
            }

            let where: any = { isSuspended: false, deletedAt: null };
            if (taxYears && taxYears.length > 0) {
                where.workspaces = { some: { taxYear: { in: taxYears }, deletedAt: null } };
            }

            const count = await ctx.prisma.user.count({ where });
            return { count };
        }),

    getAvailableTaxYears: adminProcedure.query(async ({ ctx }) => {
        const years = await ctx.prisma.workspace.findMany({
            where: { deletedAt: null },
            select: { taxYear: true },
            distinct: ['taxYear'],
            orderBy: { taxYear: 'desc' },
        });
        return years.map(y => y.taxYear);
    }),

    createBroadcast: operationsProcedure
        .input(z.object({
            subject: z.string().min(1),
            body: z.string().min(1),
            channel: z.enum(['EMAIL', 'IN_APP', 'BOTH']),
            segmentType: z.enum(['ALL', 'SUBSCRIBERS', 'FREE', 'CUSTOM']),
            segmentConfig: z.any().optional(),
            taxYears: z.array(z.number()).optional(),
            scheduledAt: z.coerce.date().optional(),
            saveAsDraft: z.boolean().default(false),
        }))
        .mutation(async ({ ctx, input }) => {
            const userIds = await resolveRecipients(ctx.prisma, input.segmentType, input.taxYears);
            const totalRecipients = userIds.length;

            const status = input.saveAsDraft 
                ? 'DRAFT' 
                : (input.scheduledAt ? 'SCHEDULED' : 'SENDING');

            const broadcast = await ctx.prisma.broadcast.create({
                data: {
                    subject: input.subject,
                    body: input.body,
                    channel: input.channel,
                    segmentType: input.segmentType,
                    segmentConfig: { ...(input.segmentConfig || {}), taxYears: input.taxYears || [] },
                    scheduledAt: input.scheduledAt,
                    status: status as any,
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
                        status: broadcast.status,
                        channel: broadcast.channel,
                        segmentType: broadcast.segmentType,
                        totalRecipients
                    }
                }
            });

            if (!input.saveAsDraft && !input.scheduledAt) {
                executeBroadcastSend(ctx.prisma, broadcast.id, userIds, input.channel, input.subject, input.body)
                    .catch(err => console.error('[Broadcast] Send failed:', err));
            }

            return broadcast;
        })
});

// ─── Helper: Resolve recipient user IDs ─────────────────

async function resolveRecipients(
    prisma: any,
    segmentType: string,
    taxYears?: number[]
): Promise<string[]> {
    let where: any = { isSuspended: false, deletedAt: null };

    if (segmentType === 'SUBSCRIBERS') {
        const wsFilter: any = { isUnlocked: true, deletedAt: null };
        if (taxYears && taxYears.length > 0) wsFilter.taxYear = { in: taxYears };
        where.workspaces = { some: wsFilter };
    } else if (segmentType === 'FREE') {
        where.workspaces = { none: { isUnlocked: true, deletedAt: null } };
        if (taxYears && taxYears.length > 0) {
            where.workspaces = {
                ...where.workspaces,
                some: { taxYear: { in: taxYears }, deletedAt: null }
            };
        }
    } else if (taxYears && taxYears.length > 0) {
        where.workspaces = { some: { taxYear: { in: taxYears }, deletedAt: null } };
    }

    const users = await prisma.user.findMany({ where, select: { id: true, email: true, name: true } });
    return users.map((u: any) => u.id);
}

// ─── Helper: Execute broadcast send ─────────────────────

async function executeBroadcastSend(
    prisma: any,
    broadcastId: string,
    userIds: string[],
    channel: string,
    subject: string,
    body: string
) {
    let delivered = 0;
    let failed = 0;

    const users = await prisma.user.findMany({
        where: { id: { in: userIds } },
        select: { id: true, email: true, name: true }
    });

    for (const user of users) {
        try {
            let resendEmailId: string | null = null;

            if (channel === 'EMAIL' || channel === 'BOTH') {
                const result = await sendBroadcastEmail({
                    email: user.email,
                    name: user.name || '',
                    subject,
                    body,
                    tags: [
                        { name: 'message_type', value: 'broadcast' },
                        { name: 'user_id', value: user.id },
                        { name: 'broadcast_id', value: broadcastId },
                    ],
                });
                resendEmailId = result.providerMessageId;
            }

            if (channel === 'IN_APP' || channel === 'BOTH') {
                await prisma.notification.create({
                    data: {
                        userId: user.id,
                        title: subject,
                        message: body.replace(/<[^>]*>/g, '').slice(0, 200),
                        type: 'INFO',
                    }
                });
            }

            await prisma.broadcastRecipient.create({
                data: {
                    broadcastId,
                    userId: user.id,
                    channel: channel as any,
                    resendEmailId,
                    deliveryStatus: channel === 'IN_APP' ? 'NOT_APPLICABLE' : 'SENT',
                    lastEventType: channel === 'IN_APP' ? 'in_app.sent' : 'email.sent',
                    lastEventAt: new Date(),
                }
            });

            delivered++;
        } catch (err) {
            failed++;
            console.error(`[Broadcast] Failed for user ${user.id}:`, err);

            await prisma.broadcastRecipient.create({
                data: {
                    broadcastId,
                    userId: user.id,
                    channel: channel as any,
                    deliveryStatus: 'FAILED',
                    lastEventType: 'email.failed',
                    lastEventAt: new Date(),
                    failedAt: new Date(),
                    failReason: err instanceof Error ? err.message : String(err),
                }
            });
        }
    }

    await prisma.broadcast.update({
        where: { id: broadcastId },
        data: {
            status: failed > 0 ? 'PARTIALLY_FAILED' : 'SENT',
            sentAt: new Date(),
            delivered,
            failed,
        }
    });
}

// ─── Scheduled Broadcast Poller ─────────────────────────
// Checks every 60 seconds for SCHEDULED broadcasts whose scheduledAt has passed

export function startScheduledBroadcastPoller(prisma: PrismaClient) {
    const POLL_INTERVAL = 60_000; // 60 seconds

    async function processScheduled() {
        try {
            const readyBroadcasts = await prisma.broadcast.findMany({
                where: {
                    status: 'SCHEDULED',
                    scheduledAt: { lte: new Date() },
                }
            });

            for (const broadcast of readyBroadcasts) {
                console.log(`[Broadcast Poller] Sending scheduled broadcast: ${broadcast.id} — "${broadcast.subject}"`);

                // Mark as SENDING
                await prisma.broadcast.update({
                    where: { id: broadcast.id },
                    data: { status: 'SENDING' }
                });

                // Resolve recipients from stored segment
                const config = broadcast.segmentConfig as any;
                const taxYears = config?.taxYears?.length > 0 ? config.taxYears : undefined;
                const userIds = await resolveRecipients(prisma, broadcast.segmentType, taxYears);

                // Execute send
                await executeBroadcastSend(prisma, broadcast.id, userIds, broadcast.channel, broadcast.subject, broadcast.body);
                console.log(`[Broadcast Poller] Completed broadcast: ${broadcast.id}`);
            }
        } catch (err) {
            console.error('[Broadcast Poller] Error:', err);
        }
    }

    // Run immediately on startup, then every 60s
    processScheduled();
    setInterval(processScheduled, POLL_INTERVAL);
    console.log('📡 Broadcast scheduler polling every 60 seconds');
}
