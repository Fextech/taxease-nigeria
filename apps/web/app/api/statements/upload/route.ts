import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const BUCKET = process.env.AWS_S3_BUCKET_NAME || 'taxease-statements-dev';
const URL_EXPIRY = Number(process.env.S3_PRESIGNED_URL_EXPIRY) || 900;

const s3 = new S3Client({
    region: process.env.AWS_REGION || 'af-south-1',
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
    },
});

/**
 * POST /api/statements/upload
 *
 * Handles the multi-step upload flow:
 * 1. action: "getUploadUrl" → returns a presigned S3 URL
 * 2. action: "confirm" → creates the Statement record after S3 upload succeeds
 * 3. action: "list" → list statements for a workspace
 * 4. action: "delete" → delete a statement
 */
export async function POST(request: Request) {
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { action, ...data } = body;

    try {
        if (action === 'getUploadUrl') {
            // Validate workspace ownership
            const workspace = await prisma.workspace.findUnique({
                where: { id: data.workspaceId },
            });

            if (!workspace || workspace.userId !== session.user.id) {
                return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
            }

            if (workspace.status === 'LOCKED') {
                return NextResponse.json({ error: 'Workspace is locked' }, { status: 403 });
            }

            // Check if month already has a statement
            const existing = await prisma.statement.findUnique({
                where: {
                    workspaceId_month: {
                        workspaceId: data.workspaceId,
                        month: data.month,
                    },
                },
            });

            if (existing) {
                return NextResponse.json(
                    { error: `A statement already exists for this month. Delete it first to re-upload.` },
                    { status: 409 }
                );
            }

            // Check duplicate file hash
            if (data.fileHash) {
                const duplicate = await prisma.statement.findFirst({
                    where: {
                        fileHash: data.fileHash,
                        workspace: { userId: session.user.id },
                    },
                });

                if (duplicate) {
                    return NextResponse.json(
                        { error: 'This file has already been uploaded.' },
                        { status: 409 }
                    );
                }
            }

            // Generate S3 key and presigned URL directly
            const sanitized = data.filename.replace(/[^a-zA-Z0-9._-]/g, '_');
            const s3Key = `statements/${session.user.id}/${data.workspaceId}/${data.month}/${Date.now()}_${sanitized}`;

            const command = new PutObjectCommand({
                Bucket: BUCKET,
                Key: s3Key,
                ContentType: data.mimeType,
            });

            const uploadUrl = await getSignedUrl(s3, command, { expiresIn: URL_EXPIRY });

            return NextResponse.json({ uploadUrl, s3Key });

        } else if (action === 'confirm') {
            // Create statement record directly via Prisma
            const statement = await prisma.statement.create({
                data: {
                    workspaceId: data.workspaceId,
                    month: data.month,
                    s3Key: data.s3Key,
                    originalFilename: data.originalFilename,
                    mimeType: data.mimeType,
                    fileHash: data.fileHash || null,
                    parseStatus: 'PROCESSING',
                },
            });

            // Enqueue job for background worker
            try {
                const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
                const { Queue } = require('bullmq');
                const parseStatementQueue = new Queue('parse-statement', {
                    connection: {
                        host: new URL(REDIS_URL).hostname || 'localhost',
                        port: Number(new URL(REDIS_URL).port) || 6379,
                    },
                });

                await parseStatementQueue.add(
                    'parse',
                    { statementId: statement.id, pdfPassword: data.pdfPassword },
                    {
                        attempts: 3,
                        backoff: { type: 'exponential', delay: 5000 },
                        removeOnComplete: 100,
                        removeOnFail: 200,
                    }
                );
            } catch (err) {
                console.error("[statements/upload] Failed to enqueue job:", err);
            }

            return NextResponse.json(statement);

        } else if (action === 'list') {
            const statements = await prisma.statement.findMany({
                where: { workspaceId: data.workspaceId },
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

            return NextResponse.json(statements);

        } else if (action === 'delete') {
            const statement = await prisma.statement.findUnique({
                where: { id: data.statementId },
                include: { workspace: { select: { userId: true, status: true } } },
            });

            if (!statement || statement.workspace.userId !== session.user.id) {
                return NextResponse.json({ error: 'Statement not found' }, { status: 404 });
            }

            if (statement.workspace.status === 'LOCKED') {
                return NextResponse.json({ error: 'Workspace is locked' }, { status: 403 });
            }

            // Delete file from S3
            try {
                await s3.send(new DeleteObjectCommand({
                    Bucket: BUCKET,
                    Key: statement.s3Key,
                }));
            } catch (s3Err) {
                console.error('[statements/upload] S3 delete failed:', s3Err);
                // Continue with DB deletion even if S3 fails
            }

            // Cascade delete
            await prisma.annotation.deleteMany({
                where: { transaction: { statementId: data.statementId } },
            });
            await prisma.transaction.deleteMany({
                where: { statementId: data.statementId },
            });
            await prisma.statement.delete({
                where: { id: data.statementId },
            });

            return NextResponse.json({ success: true });
        }

        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error('Statement upload error:', message, error);
        return NextResponse.json(
            { error: 'Internal server error', detail: message },
            { status: 500 }
        );
    }
}
