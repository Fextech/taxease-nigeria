/**
 * Prisma Soft-Delete Extension (Prisma v6+)
 * Web app copy — identical to apps/api/src/lib/prisma-soft-delete.ts
 */

import { PrismaClient } from "@prisma/client";

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

export function active() {
    return { deletedAt: null };
}
