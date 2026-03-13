import { Worker, Job } from 'bullmq';
import pino from 'pino';
import { PrismaClient } from '@prisma/client';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';

const logger = pino({
    transport: {
        target: 'pino-pretty',
        options: { translateTime: 'HH:MM:ss Z', ignore: 'pid,hostname' },
    },
});

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

// Use inline connection config to avoid ioredis version mismatch with BullMQ
const redisConnection = {
    host: new URL(REDIS_URL).hostname || 'localhost',
    port: Number(new URL(REDIS_URL).port) || 6379,
};

const PARSER_URL = process.env.PARSER_URL || 'http://localhost:8000';

const prisma = new PrismaClient();

const s3 = new S3Client({
    region: process.env.AWS_REGION || 'af-south-1',
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
    },
});

const BUCKET = process.env.AWS_S3_BUCKET_NAME || 'taxease-statements-dev';

// ─── Types ───────────────────────────────────────────────

interface ParsedTransaction {
    transaction_date: string;
    value_date?: string | null;
    description: string;
    credit_amount: number;
    debit_amount: number;
    balance?: number | null;
    reference?: string | null;
    channel?: string | null;
    confidence: number;
}

interface ParserResponse {
    bank_name: string;
    transactions: ParsedTransaction[];
    overall_confidence: number;
    row_count: number;
    notes?: string;
}

// ─── Helpers ─────────────────────────────────────────────

async function downloadFromS3(key: string): Promise<Buffer> {
    const command = new GetObjectCommand({ Bucket: BUCKET, Key: key });
    const response = await s3.send(command);
    const stream = response.Body;
    if (!stream) throw new Error('Empty S3 response body');

    const chunks: Uint8Array[] = [];
    for await (const chunk of stream as AsyncIterable<Uint8Array>) {
        chunks.push(chunk);
    }
    return Buffer.concat(chunks);
}

async function sendToParser(fileBuffer: Buffer, filename: string, mimeType: string, password?: string): Promise<ParserResponse> {
    const formData = new FormData();
    const blob = new Blob([fileBuffer], { type: mimeType });
    formData.append('file', blob, filename);
    if (password) {
        formData.append('password', password);
    }

    const response = await fetch(`${PARSER_URL}/parse`, {
        method: 'POST',
        body: formData,
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Parser returned ${response.status}: ${errorText}`);
    }

    return response.json() as Promise<ParserResponse>;
}

// ─── Parse Statement Worker ──────────────────────────────

const parseStatementWorker = new Worker(
    'parse-statement',
    async (job: Job) => {
        const { statementId } = job.data;
        logger.info({ jobId: job.id, statementId }, '📄 Processing parse-statement job');

        try {
            // 1. Fetch statement record from DB
            const statement = await prisma.statement.findUnique({
                where: { id: statementId },
            });

            if (!statement) {
                throw new Error(`Statement ${statementId} not found in database`);
            }

            await job.updateProgress(10);

            // 2. Download the file from S3
            let fileBuffer: Buffer;
            try {
                fileBuffer = await downloadFromS3(statement.s3Key);
                logger.info(
                    { statementId, size: fileBuffer.length },
                    '⬇️  Downloaded file from S3'
                );
            } catch (s3Error) {
                logger.warn({ statementId }, '⚠️  S3 download failed — skipping parse in dev mode');
                await prisma.statement.update({
                    where: { id: statementId },
                    data: {
                        parseStatus: 'ERROR',
                        errorMessage: 'S3 not configured. Set AWS credentials to enable parsing.',
                    },
                });
                return;
            }

            await job.updateProgress(30);

            // 3. Send the file to the Python parser service
            let parseResult: ParserResponse;

            try {
                parseResult = await sendToParser(
                    fileBuffer,
                    statement.originalFilename,
                    statement.mimeType,
                    job.data.pdfPassword
                );
                logger.info(
                    { statementId, rows: parseResult.row_count, bank: parseResult.bank_name },
                    '🤖 Parser returned results'
                );
            } catch (parserError) {
                logger.error({ statementId, error: parserError }, '❌ Parser service failed');
                await prisma.statement.update({
                    where: { id: statementId },
                    data: {
                        parseStatus: 'ERROR',
                        errorMessage: `Parser service error: ${parserError instanceof Error ? parserError.message : String(parserError)}`,
                    },
                });
                return;
            }

            await job.updateProgress(60);

            // 4. Bulk insert parsed transactions into the database
            if (parseResult.transactions.length > 0) {
                await prisma.transaction.createMany({
                    data: parseResult.transactions.map((tx) => ({
                        statementId,
                        transactionDate: new Date(tx.transaction_date),
                        description: tx.description,
                        creditAmount: BigInt(tx.credit_amount),
                        debitAmount: BigInt(tx.debit_amount),
                        balance: tx.balance != null ? BigInt(tx.balance) : null,
                        channel: tx.channel || null,
                        confidence: tx.confidence,
                    })),
                });

                logger.info(
                    { statementId, count: parseResult.transactions.length },
                    '💾 Saved transactions to database'
                );
            }

            await job.updateProgress(85);

            // 5. Update statement record with results
            await prisma.statement.update({
                where: { id: statementId },
                data: {
                    parseStatus: 'READY',
                    bankName: parseResult.bank_name,
                    confidenceScore: parseResult.overall_confidence,
                    rowCount: parseResult.row_count,
                    errorMessage: null,
                },
            });

            await job.updateProgress(100);
            logger.info({ jobId: job.id, statementId }, '✅ Parse-statement job completed');
        } catch (error) {
            logger.error({ jobId: job.id, statementId, error }, '❌ Parse-statement job failed');

            try {
                await prisma.statement.update({
                    where: { id: statementId },
                    data: {
                        parseStatus: 'ERROR',
                        errorMessage: error instanceof Error ? error.message : String(error),
                    },
                });
            } catch {
                logger.error({ statementId }, 'Failed to update statement error status');
            }

            throw error; // Re-throw so BullMQ retries
        }
    },
    { connection: redisConnection, concurrency: 3 }
);

// ─── Generate Report Worker (stub) ──────────────────────

const generateReportWorker = new Worker(
    'generate-report',
    async (job) => {
        logger.info({ jobId: job.id, data: job.data }, '📊 Processing generate-report job');
        // Stub processor — will be implemented in Phase 7
        logger.info({ jobId: job.id }, '✅ Generate-report job completed (stub)');
    },
    { connection: redisConnection, concurrency: 2 }
);

// ─── Graceful shutdown ──────────────────────────────────

const shutdown = async () => {
    logger.info('Shutting down workers...');
    await parseStatementWorker.close();
    await generateReportWorker.close();
    await prisma.$disconnect();
    process.exit(0);
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

logger.info('🔧 TaxEase Worker running — waiting for jobs...');
