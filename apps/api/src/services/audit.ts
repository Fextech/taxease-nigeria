import { prisma } from '../db/prisma.js';
import type { Prisma } from '@prisma/client';

/**
 * Log an auditable action to the AuditLog table.
 */
export async function logAction(params: {
    userId: string;
    entityType: string;
    entityId: string;
    action: string;
    oldValue?: Prisma.JsonValue;
    newValue?: Prisma.JsonValue;
    ipAddress?: string;
    userAgent?: string;
}) {
    return prisma.auditLog.create({
        data: {
            userId: params.userId,
            entityType: params.entityType,
            entityId: params.entityId,
            action: params.action,
            oldValue: params.oldValue ?? undefined,
            newValue: params.newValue ?? undefined,
            ipAddress: params.ipAddress,
            userAgent: params.userAgent,
        },
    });
}
