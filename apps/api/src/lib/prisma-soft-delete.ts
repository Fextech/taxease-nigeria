/**
 * Prisma Soft-Delete Extension (Prisma v6+)
 *
 * Uses Prisma Client Extensions to intercept delete operations:
 * - `delete` → sets `deletedAt = now()` instead of removing the row
 * - `deleteMany` → updates `deletedAt = now()` on matched rows
 * - Read queries are NOT auto-filtered — callers should add `deletedAt: null`
 *   to their where clauses, or use the helper functions below.
 *
 * This approach is more explicit and avoids the hidden behavior that
 * caused bugs with the old $use middleware pattern.
 *
 * Models covered: Workspace, Statement, Transaction, Annotation
 */

import { PrismaClient } from "@prisma/client";

/**
 * Creates a Prisma client with soft-delete extensions.
 * Instead of auto-filtering reads (which can cause subtle bugs),
 * this provides explicit `softDelete` and `softDeleteMany` methods
 * and a `whereActive` helper for queries.
 */
export function createSoftDeleteClient(baseClient: PrismaClient) {
    return baseClient.$extends({
        model: {
            $allModels: {
                async softDelete<T>(
                    this: T,
                    args: { where: Record<string, unknown> }
                ): Promise<unknown> {
                    const ctx = this as unknown as { update: (args: { where: Record<string, unknown>, data: { deletedAt: Date } }) => Promise<unknown> };
                    return ctx.update({
                        where: args.where,
                        data: { deletedAt: new Date() },
                    });
                },

                async softDeleteMany<T>(
                    this: T,
                    args: { where: Record<string, unknown> }
                ): Promise<unknown> {
                    const ctx = this as unknown as { updateMany: (args: { where: Record<string, unknown>, data: { deletedAt: Date } }) => Promise<unknown> };
                    return ctx.updateMany({
                        where: args.where,
                        data: { deletedAt: new Date() },
                    });
                },
            },
        },
    });
}

/**
 * Helper to add the `deletedAt: null` filter to any where clause.
 * Usage: prisma.statement.findMany({ where: { ...active(), workspaceId } })
 */
export function active() {
    return { deletedAt: null };
}
