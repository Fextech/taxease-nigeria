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
