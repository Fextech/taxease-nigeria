import type { FastifyRequest, FastifyReply } from 'fastify';
import pino from 'pino';
import { PrismaClient } from '@prisma/client';
import { downloadFromS3 } from '../lib/s3.js';

const logger = pino({
    transport: {
        target: 'pino-pretty',
        options: { translateTime: 'HH:MM:ss Z', ignore: 'pid,hostname' },
    },
});

const prisma = new PrismaClient();

let PARSER_URL = process.env.PARSER_URL || 'http://localhost:8000';
if (!PARSER_URL.startsWith('http://') && !PARSER_URL.startsWith('https://')) {
    PARSER_URL = `https://${PARSER_URL}`;
}

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

// ─── Parser call ─────────────────────────────────────────

async function sendToParser(
    fileBuffer: Buffer,
    filename: string,
    mimeType: string,
    password?: string
): Promise<ParserResponse> {
    const formData = new FormData();
    const blob = new Blob([fileBuffer], { type: mimeType });
    formData.append('file', blob, filename);
    if (password) formData.append('password', password);

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

// ─── Request body type ───────────────────────────────────

interface ParseStatementBody {
    statementId: string;
    pdfPassword?: string;
}

// ─── Handler ─────────────────────────────────────────────

/**
 * POST /jobs/parse-statement
 *
 * Called by Google Cloud Tasks when a statement is ready to parse.
 * Returns:
 *   200 — success (Cloud Tasks marks task done, no retry)
 *   422 — unprocessable (bad file, no retry)
 *   500 — transient error (Cloud Tasks will retry with backoff)
 */
export async function parseStatementHandler(
    request: FastifyRequest<{ Body: ParseStatementBody }>,
    reply: FastifyReply
): Promise<void> {
    const { statementId, pdfPassword } = request.body;

    if (!statementId) {
        reply.code(422).send({ error: 'Missing statementId in request body' });
        return;
    }

    logger.info({ statementId }, '📄 Processing parse-statement job');
    let statement: any = null;

    try {
        statement = await prisma.statement.findUnique({
            where: { id: statementId },
            include: { workspace: true },
        });

        if (!statement) {
            // Non-retriable — the statement doesn't exist
            logger.error({ statementId }, 'Statement not found — returning 422');
            reply.code(422).send({ error: `Statement ${statementId} not found` });
            return;
        }

        // Idempotency guard: if already READY, skip silently
        if (statement.parseStatus === 'READY') {
            logger.info({ statementId }, '⏭️  Statement already READY — skipping');
            reply.code(200).send({ success: true, skipped: true });
            return;
        }

        // ── Download from S3 ───────────────────────────────
        let fileBuffer: Buffer;
        try {
            fileBuffer = await downloadFromS3(statement.s3Key);
            logger.info({ statementId, size: fileBuffer.length }, '⬇️  Downloaded from S3');
        } catch (err) {
            logger.warn({ statementId }, '⚠️  S3 download failed');
            await prisma.statement.update({
                where: { id: statementId },
                data: {
                    parseStatus: 'ERROR',
                    errorMessage: 'S3 not configured. Set AWS credentials to enable parsing.',
                },
            });
            // Non-retriable (configuration error)
            reply.code(422).send({ error: 'S3 download failed — check AWS credentials' });
            return;
        }

        // ── Call parser service ────────────────────────────
        let parseResult: ParserResponse;
        try {
            parseResult = await sendToParser(
                fileBuffer,
                statement.originalFilename,
                statement.mimeType,
                pdfPassword
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
            // Return 500 so Cloud Tasks retries (parser might be cold-starting)
            reply.code(500).send({ error: 'Parser service failed' });
            return;
        }

        if (!parseResult.transactions || parseResult.transactions.length === 0) {
            const msg = 'Parser returned 0 transactions. The file may be an unsupported format, poorly scanned, or empty.';
            await prisma.statement.update({
                where: { id: statementId },
                data: { parseStatus: 'ERROR', errorMessage: msg },
            });
            // Non-retriable (content issue)
            reply.code(422).send({ error: msg });
            return;
        }

        // ── Save transactions ──────────────────────────────
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

        // ── Mark as READY ──────────────────────────────────
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

        // ── Notify user ────────────────────────────────────
        await prisma.notification.create({
            data: {
                userId: statement.workspace.userId,
                title: 'Statement Processed',
                message: `Successfully extracted ${parseResult.row_count} transactions from your statement.`,
                type: 'SUCCESS',
                link: '/statements',
            },
        });

        logger.info({ statementId }, '✅ parse-statement completed');
        reply.code(200).send({ success: true, rowCount: parseResult.row_count });
    } catch (error) {
        logger.error({ statementId, error }, '❌ parse-statement failed unexpectedly');

        try {
            if (statement) {
                await prisma.statement.update({
                    where: { id: statementId },
                    data: {
                        parseStatus: 'ERROR',
                        errorMessage: error instanceof Error ? error.message : String(error),
                    },
                });
                await prisma.notification.create({
                    data: {
                        userId: statement.workspace.userId,
                        title: 'Statement Processing Failed',
                        message: `Failed to process ${statement.originalFilename}.`,
                        type: 'ERROR',
                        link: '/statements',
                    },
                });
            }
        } catch (dbErr) {
            logger.error({ statementId, dbErr }, 'Failed to update statement error status');
        }

        // Return 500 — Cloud Tasks will retry
        reply.code(500).send({
            error: error instanceof Error ? error.message : String(error),
        });
    }
}
