import { z } from 'zod';
import { router, protectedProcedure } from '../trpc/trpc.js';
import { generateUploadUrl, buildStatementKey } from '../services/s3.service.js';
import { enqueueParseJob } from '../services/queue.service.js';
import { logAction } from '../services/audit.js';
import { TRPCError } from '@trpc/server';

// ─── Allowed MIME types ──────────────────────────────────
const ALLOWED_MIME_TYPES = [
    'application/pdf',
    'text/csv',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
];

const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20 MB

export const statementsRouter = router({
    // ─── Get Upload URL ──────────────────────────────────
    getUploadUrl: protectedProcedure
        .input(
            z.object({
                workspaceId: z.string().cuid(),
                month: z.number().int().min(1).max(12),
                filename: z.string().min(1).max(255),
                mimeType: z.string(),
                fileSize: z.number().int().positive().max(MAX_FILE_SIZE, 'File exceeds 20 MB limit'),
                fileHash: z.string().min(1).optional(),
            })
        )
        .mutation(async ({ ctx, input }) => {
            // Validate workspace ownership
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
                    code: 'FORBIDDEN',
                    message: 'This workspace is locked and cannot accept new uploads.',
                });
            }

            // Validate MIME type
            if (!ALLOWED_MIME_TYPES.includes(input.mimeType)) {
                throw new TRPCError({
                    code: 'BAD_REQUEST',
                    message: `Unsupported file type. Allowed: PDF, CSV, Excel.`,
                });
            }

            // Check for existing statement in this month
            const existing = await ctx.prisma.statement.findUnique({
                where: {
                    workspaceId_month: {
                        workspaceId: input.workspaceId,
                        month: input.month,
                    },
                },
            });

            if (existing) {
                throw new TRPCError({
                    code: 'CONFLICT',
                    message: `A statement already exists for month ${input.month}. Delete it first to re-upload.`,
                });
            }

            // Check for duplicate file hash
            if (input.fileHash) {
                const duplicate = await ctx.prisma.statement.findFirst({
                    where: {
                        fileHash: input.fileHash,
                        workspace: { userId: ctx.user.id },
                    },
                });

                if (duplicate) {
                    throw new TRPCError({
                        code: 'CONFLICT',
                        message: 'This file has already been uploaded to another month.',
                    });
                }
            }

            // Generate S3 key and presigned URL
            const s3Key = buildStatementKey(ctx.user.id, input.workspaceId, input.month, input.filename);
            const { url } = await generateUploadUrl(s3Key, input.mimeType);

            return { uploadUrl: url, s3Key };
        }),

    // ─── Confirm Upload ──────────────────────────────────
    confirm: protectedProcedure
        .input(
            z.object({
                workspaceId: z.string().cuid(),
                month: z.number().int().min(1).max(12),
                s3Key: z.string().min(1),
                originalFilename: z.string().min(1),
                mimeType: z.string(),
                fileHash: z.string().optional(),
            })
        )
        .mutation(async ({ ctx, input }) => {
            // Verify workspace ownership
            const workspace = await ctx.prisma.workspace.findUnique({
                where: { id: input.workspaceId },
            });

            if (!workspace || workspace.userId !== ctx.user.id) {
                throw new TRPCError({
                    code: 'NOT_FOUND',
                    message: 'Workspace not found.',
                });
            }

            // Create statement record
            const statement = await ctx.prisma.statement.create({
                data: {
                    workspaceId: input.workspaceId,
                    month: input.month,
                    s3Key: input.s3Key,
                    originalFilename: input.originalFilename,
                    mimeType: input.mimeType,
                    fileHash: input.fileHash || null,
                    parseStatus: 'UPLOADED',
                },
            });

            // Enqueue parse job
            await enqueueParseJob(statement.id);

            // Update statement status to PROCESSING
            await ctx.prisma.statement.update({
                where: { id: statement.id },
                data: { parseStatus: 'PROCESSING' },
            });

            await logAction({
                userId: ctx.user.id,
                entityType: 'Statement',
                entityId: statement.id,
                action: 'UPLOAD',
                newValue: {
                    month: input.month,
                    filename: input.originalFilename,
                },
            });

            return statement;
        }),

    // ─── List Statements ─────────────────────────────────
    list: protectedProcedure
        .input(z.object({ workspaceId: z.string().cuid() }))
        .query(async ({ ctx, input }) => {
            const workspace = await ctx.prisma.workspace.findUnique({
                where: { id: input.workspaceId },
            });

            if (!workspace || workspace.userId !== ctx.user.id) {
                throw new TRPCError({
                    code: 'NOT_FOUND',
                    message: 'Workspace not found.',
                });
            }

            return ctx.prisma.statement.findMany({
                where: { workspaceId: input.workspaceId },
                orderBy: { month: 'asc' },
                select: {
                    id: true,
                    month: true,
                    bankName: true,
                    originalFilename: true,
                    parseStatus: true,
                    confidenceScore: true,
                    rowCount: true,
                    errorMessage: true,
                    createdAt: true,
                },
            });
        }),

    // ─── Get Parse Status ────────────────────────────────
    getStatus: protectedProcedure
        .input(z.object({ statementId: z.string().cuid() }))
        .query(async ({ ctx, input }) => {
            const statement = await ctx.prisma.statement.findUnique({
                where: { id: input.statementId },
                include: {
                    workspace: { select: { userId: true } },
                },
            });

            if (!statement || statement.workspace.userId !== ctx.user.id) {
                throw new TRPCError({
                    code: 'NOT_FOUND',
                    message: 'Statement not found.',
                });
            }

            return {
                id: statement.id,
                parseStatus: statement.parseStatus,
                confidenceScore: statement.confidenceScore,
                rowCount: statement.rowCount,
                errorMessage: statement.errorMessage,
                bankName: statement.bankName,
            };
        }),

    // ─── Delete Statement ────────────────────────────────
    delete: protectedProcedure
        .input(z.object({ statementId: z.string().cuid() }))
        .mutation(async ({ ctx, input }) => {
            const statement = await ctx.prisma.statement.findUnique({
                where: { id: input.statementId },
                include: {
                    workspace: { select: { userId: true, status: true } },
                },
            });

            if (!statement || statement.workspace.userId !== ctx.user.id) {
                throw new TRPCError({
                    code: 'NOT_FOUND',
                    message: 'Statement not found.',
                });
            }

            if (statement.workspace.status === 'LOCKED') {
                throw new TRPCError({
                    code: 'FORBIDDEN',
                    message: 'Cannot delete statements from a locked workspace.',
                });
            }

            // Delete associated transactions and annotations first
            await ctx.prisma.annotation.deleteMany({
                where: {
                    transaction: { statementId: input.statementId },
                },
            });
            await ctx.prisma.transaction.deleteMany({
                where: { statementId: input.statementId },
            });
            await ctx.prisma.statement.delete({
                where: { id: input.statementId },
            });

            await logAction({
                userId: ctx.user.id,
                entityType: 'Statement',
                entityId: input.statementId,
                action: 'DELETE',
                oldValue: {
                    month: statement.month,
                    filename: statement.originalFilename,
                },
            });

            return { success: true };
        }),
});
