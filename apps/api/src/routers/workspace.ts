import { z } from 'zod';
import { router, protectedProcedure } from '../trpc/trpc.js';
import { createWorkspaceSchema, lockWorkspaceSchema } from '@taxease/shared';
import { logAction } from '../services/audit.js';
import { TRPCError } from '@trpc/server';

export const workspaceRouter = router({
    // ─── Create ──────────────────────────────────────────
    create: protectedProcedure
        .input(createWorkspaceSchema)
        .mutation(async ({ ctx, input }) => {
            // Check if workspace already exists for this year
            const existing = await ctx.prisma.workspace.findUnique({
                where: {
                    userId_taxYear: {
                        userId: ctx.user.id,
                        taxYear: input.taxYear,
                    },
                },
            });

            if (existing) {
                throw new TRPCError({
                    code: 'CONFLICT',
                    message: `Workspace for tax year ${input.taxYear} already exists.`,
                });
            }

            const workspace = await ctx.prisma.workspace.create({
                data: {
                    userId: ctx.user.id,
                    taxYear: input.taxYear,
                },
            });

            await logAction({
                userId: ctx.user.id,
                entityType: 'Workspace',
                entityId: workspace.id,
                action: 'CREATE',
                newValue: { taxYear: input.taxYear },
            });

            return workspace;
        }),

    // ─── List ────────────────────────────────────────────
    list: protectedProcedure.query(async ({ ctx }) => {
        return ctx.prisma.workspace.findMany({
            where: { userId: ctx.user.id },
            orderBy: { taxYear: 'desc' },
            include: {
                _count: {
                    select: { statements: true },
                },
            },
        });
    }),

    // ─── Get ─────────────────────────────────────────────
    get: protectedProcedure
        .input(z.object({ id: z.string().cuid() }))
        .query(async ({ ctx, input }) => {
            const workspace = await ctx.prisma.workspace.findUnique({
                where: { id: input.id },
                include: {
                    statements: {
                        orderBy: { month: 'asc' },
                    },
                    _count: {
                        select: { statements: true, delegations: true },
                    },
                },
            });

            if (!workspace || workspace.userId !== ctx.user.id) {
                throw new TRPCError({
                    code: 'NOT_FOUND',
                    message: 'Workspace not found.',
                });
            }

            return workspace;
        }),

    // ─── Lock ────────────────────────────────────────────
    lock: protectedProcedure
        .input(lockWorkspaceSchema)
        .mutation(async ({ ctx, input }) => {
            const workspace = await ctx.prisma.workspace.findUnique({
                where: { id: input.workspaceId },
            });

            if (!workspace || workspace.userId !== ctx.user.id) {
                throw new TRPCError({
                    code: 'NOT_FOUND',
                    message: 'Workspace not found.',
                });
            }

            if (workspace.status === 'LOCKED') {
                throw new TRPCError({
                    code: 'BAD_REQUEST',
                    message: 'Workspace is already locked.',
                });
            }

            const updated = await ctx.prisma.workspace.update({
                where: { id: input.workspaceId },
                data: { status: 'LOCKED' },
            });

            await logAction({
                userId: ctx.user.id,
                entityType: 'Workspace',
                entityId: workspace.id,
                action: 'LOCK',
                oldValue: { status: workspace.status },
                newValue: { status: 'LOCKED' },
            });

            return updated;
        }),
});
