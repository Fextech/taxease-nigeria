import { initTRPC, TRPCError } from '@trpc/server';
import type { Context } from './context.js';

const t = initTRPC.context<Context>().create();

export const router = t.router;
export const publicProcedure = t.procedure;

// Protected procedure — requires authenticated user via NextAuth JWT
export const protectedProcedure = t.procedure.use(async ({ ctx, next }) => {
    if (!ctx.user) {
        throw new TRPCError({
            code: 'UNAUTHORIZED',
            message: 'You must be signed in to access this resource.',
        });
    }
    return next({
        ctx: {
            ...ctx,
            user: ctx.user,
        },
    });
});

// Admin procedure — requires authenticated admin via custom JWT
export const adminProcedure = t.procedure.use(async ({ ctx, next }) => {
    if (!ctx.admin) {
        throw new TRPCError({
            code: 'UNAUTHORIZED',
            message: 'Admin access required.',
        });
    }
    return next({
        ctx: {
            ...ctx,
            admin: ctx.admin,
        },
    });
});

// Super-admin procedure — restricted to SUPER_ADMIN role only
export const superAdminProcedure = adminProcedure.use(async ({ ctx, next }) => {
    if (ctx.admin.role !== 'SUPER_ADMIN') {
        throw new TRPCError({
            code: 'FORBIDDEN',
            message: 'This action requires Super Admin privileges.',
        });
    }
    return next({ ctx });
});

// Operations procedure — SUPER_ADMIN or OPERATIONS_ADMIN
export const operationsProcedure = adminProcedure.use(async ({ ctx, next }) => {
    const allowed = ['SUPER_ADMIN', 'OPERATIONS_ADMIN'] as const;
    if (!allowed.includes(ctx.admin.role as typeof allowed[number])) {
        throw new TRPCError({
            code: 'FORBIDDEN',
            message: 'This action requires Operations Admin privileges.',
        });
    }
    return next({ ctx });
});

// Support procedure — SUPER_ADMIN, OPERATIONS_ADMIN, or SUPPORT_AGENT
export const supportProcedure = adminProcedure.use(async ({ ctx, next }) => {
    const allowed = ['SUPER_ADMIN', 'OPERATIONS_ADMIN', 'SUPPORT_AGENT'] as const;
    if (!allowed.includes(ctx.admin.role as typeof allowed[number])) {
        throw new TRPCError({
            code: 'FORBIDDEN',
            message: 'This action requires support privileges.',
        });
    }
    return next({ ctx });
});
