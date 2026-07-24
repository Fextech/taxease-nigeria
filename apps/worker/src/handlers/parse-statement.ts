import type { FastifyRequest, FastifyReply } from 'fastify';
import pino from 'pino';
import { PrismaClient } from '@prisma/client';
import { downloadFromS3 } from '../lib/s3.js';
import { getActiveAiProviderConfig, type ParserAiConfig } from '../lib/ai-provider-config.js';

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

/**
 * Cloud Run services require an ID token when they are not publicly
 * invokable. Locally there is no metadata server and the parser runs without
 * Cloud Run IAM, so authentication is only added when Cloud Run injects
 * K_SERVICE.
 */
async function getParserAuthorizationHeader(): Promise<Record<string, string>> {
    if (!process.env.K_SERVICE) {
        return {};
    }

    const audience = PARSER_URL.replace(/\/+$/, '');
    const metadataResponse = await fetch(
        `http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/identity?audience=${encodeURIComponent(audience)}`,
        { headers: { 'Metadata-Flavor': 'Google' } }
    );

    if (!metadataResponse.ok) {
        throw new Error(`Unable to obtain parser ID token: ${metadataResponse.status}`);
    }

    return { Authorization: `Bearer ${await metadataResponse.text()}` };
}

// ─── Parser call ─────────────────────────────────────────

async function sendToParser(
    fileBuffer: Buffer,
    filename: string,
    mimeType: string,
    password: string | undefined,
    aiConfig: ParserAiConfig
): Promise<ParserResponse> {
    const formData = new FormData();
    const blob = new Blob([fileBuffer], { type: mimeType });
    formData.append('file', blob, filename);
    if (password) formData.append('password', password);
    // This is transmitted only between the worker and parser for the lifetime
    // of this request. It is never persisted or written to logs.
    formData.append('ai_config', JSON.stringify(aiConfig));
    const authHeaders = await getParserAuthorizationHeader();

    const response = await fetch(`${PARSER_URL}/parse`, {
        method: 'POST',
        body: formData,
        headers: authHeaders,
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

        // Cloud Tasks has at-least-once delivery semantics. Atomically claim a
        // pending/retryable job so duplicate deliveries cannot insert the same
        // transactions twice.
        const claim = await prisma.statement.updateMany({
            where: {
                id: statementId,
                deletedAt: null,
                parseStatus: { in: ['UPLOADED', 'ERROR'] },
            },
            data: { parseStatus: 'PROCESSING', errorMessage: null },
        });

        if (claim.count === 0) {
            logger.info(
                { statementId, parseStatus: statement.parseStatus },
                '⏭️  Statement is already being processed or complete — skipping duplicate task'
            );
            reply.code(200).send({ success: true, skipped: true });
            return;
        }

        // ── Download from S3 ───────────────────────────────
        let fileBuffer: Buffer;
        try {
            fileBuffer = await downloadFromS3(statement.s3Key);
            logger.info({ statementId, size: fileBuffer.length }, '⬇️  Downloaded from S3');
        } catch {
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

        // ── Resolve the active AI provider and call parser ──
        let aiConfig: ParserAiConfig;
        try {
            aiConfig = await getActiveAiProviderConfig(prisma);
        } catch (configError) {
            logger.error({ statementId, configError }, 'AI provider configuration is unavailable');
            await prisma.statement.update({
                where: { id: statementId },
                data: {
                    parseStatus: 'ERROR',
                    errorMessage: 'AI provider is not configured. Ask an administrator to configure Admin Settings > AI Model.',
                },
            });
            reply.code(422).send({ error: 'AI provider configuration is unavailable' });
            return;
        }

        let parseResult: ParserResponse;
        try {
            parseResult = await sendToParser(
                fileBuffer,
                statement.originalFilename,
                statement.mimeType,
                pdfPassword,
                aiConfig
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
        await prisma.$transaction([
            prisma.transaction.createMany({
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
            }),
            prisma.statement.update({
                where: { id: statementId },
                data: {
                    parseStatus: 'READY',
                    bankName: parseResult.bank_name,
                    confidenceScore: parseResult.overall_confidence,
                    rowCount: parseResult.row_count,
                    errorMessage: null,
                },
            }),
        ]);

        logger.info(
            { statementId, count: parseResult.transactions.length },
            '💾 Saved transactions to database'
        );

        // ── Notify user ────────────────────────────────────
        // A notification failure must not make Cloud Tasks redeliver an
        // already committed parse result.
        try {
            await prisma.notification.create({
                data: {
                    userId: statement.workspace.userId,
                    title: 'Statement Processed',
                    message: `Successfully extracted ${parseResult.row_count} transactions from your statement.`,
                    type: 'SUCCESS',
                    link: '/statements',
                },
            });
        } catch (notificationError) {
            logger.error({ statementId, notificationError }, 'Failed to create processing notification');
        }

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
