import { Worker, Job } from 'bullmq';
import pino from 'pino';
import { PrismaClient } from '@prisma/client';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import puppeteer from 'puppeteer';
import { Resend } from 'resend';
import Handlebars from 'handlebars';
import fs from 'fs';
import path from 'path';
import { computeTax, type Relief } from '@banklens/shared';

// ─── Logger ──────────────────────────────────────────────

const logger = pino({
    transport: {
        target: 'pino-pretty',
        options: { translateTime: 'HH:MM:ss Z', ignore: 'pid,hostname' },
    },
});

// ─── Redis Connection (Upstash-compatible) ───────────────

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const parsedUrl = new URL(REDIS_URL);

const redisConnection = {
    host: parsedUrl.hostname,
    port: Number(parsedUrl.port) || 6379,
    password: parsedUrl.password || undefined,
    tls: REDIS_URL.startsWith('rediss://') ? {} : undefined,
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
};

// ─── Resend (lazy init to avoid startup crash) ───────────

function getResendClient(): Resend {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) throw new Error('RESEND_API_KEY environment variable is not set');
    return new Resend(apiKey);
}

const FROM_EMAIL = process.env.EMAIL_FROM || "Banklens Nigeria <onboarding@resend.dev>";

let PARSER_URL = process.env.PARSER_URL || 'http://localhost:8000';
if (!PARSER_URL.startsWith('http://') && !PARSER_URL.startsWith('https://')) {
    PARSER_URL = `https://${PARSER_URL}`;
}

const prisma = new PrismaClient();

const s3 = new S3Client({
    region: process.env.AWS_REGION || 'af-south-1',
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
    },
});

const BUCKET = process.env.AWS_S3_BUCKET_NAME || 'banklens-statements-dev';

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

function formatKobo(koboVal: bigint | number): string {
    const naira = Number(koboVal) / 100;
    return new Intl.NumberFormat('en-NG', {
        style: 'currency',
        currency: 'NGN',
        minimumFractionDigits: 2,
    }).format(naira);
}

function organizeTransactionsByMonth(transactions: any[]) {
    const months = new Map<string, any>();

    for (const tx of transactions) {
        const date = new Date(tx.transactionDate);
        const monthKey = `${date.getFullYear()}-${date.getMonth()}`;
        const monthName = date.toLocaleString('default', { month: 'long', year: 'numeric' });

        if (!months.has(monthKey)) {
            months.set(monthKey, {
                monthName,
                grossIncome: 0n,
                directBusinessExpenses: 0n,
                otherExpenses: 0n,
                taxableIncome: 0n,
                transactions: []
            });
        }

        const monthData = months.get(monthKey);

        const isCredit = tx.creditAmount > 0n;
        const amount = isCredit ? tx.creditAmount : tx.debitAmount;
        const taxableStatus = tx.annotation?.taxableStatus || 'NO';
        const isTaxable = taxableStatus === 'YES';
        const taxableAmount = tx.annotation?.taxableAmount || amount;

        if (isCredit && isTaxable) monthData.grossIncome += taxableAmount;
        if (!isCredit && isTaxable) monthData.directBusinessExpenses += taxableAmount;
        if (!isCredit && !isTaxable) monthData.otherExpenses += amount;

        const isDirectBusinessExpense = !isCredit && isTaxable;
        if (isCredit || isDirectBusinessExpense) {
            monthData.transactions.push({
                date: date.toLocaleDateString(),
                description: tx.description,
                amount: formatKobo(amount),
                isCredit,
                taxable: taxableStatus,
                reason: tx.annotation?.reason || '-'
            });
        }
    }

    return Array.from(months.values()).map(m => ({
        ...m,
        grossIncome: formatKobo(m.grossIncome),
        directBusinessExpenses: formatKobo(m.directBusinessExpenses),
        otherExpenses: formatKobo(m.otherExpenses),
        taxableIncome: formatKobo(m.grossIncome > m.directBusinessExpenses ? m.grossIncome - m.directBusinessExpenses : 0n)
    }));
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
        let statement: any = null;

        try {
            statement = await prisma.statement.findUnique({
                where: { id: statementId },
                include: { workspace: true },
            });

            if (!statement) {
                throw new Error(`Statement ${statementId} not found in database`);
            }

            await job.updateProgress(10);

            let fileBuffer: Buffer;
            try {
                fileBuffer = await downloadFromS3(statement.s3Key);
                logger.info(
                    { statementId, size: fileBuffer.length },
                    '⬇️  Downloaded file from S3'
                );
            } catch {
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

            if (!parseResult.transactions || parseResult.transactions.length === 0) {
                throw new Error("Parser returned 0 transactions. The file may be an unsupported format, poorly scanned, or empty.");
            }

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

            await job.updateProgress(85);

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

            await prisma.notification.create({
                data: {
                    userId: statement.workspace.userId,
                    title: 'Statement Processed',
                    message: `Successfully extracted ${parseResult.row_count} transactions from your statement.`,
                    type: 'SUCCESS',
                    link: '/statements'
                }
            });

            await job.updateProgress(100);
            logger.info({ jobId: job.id, statementId }, '✅ Parse-statement job completed');
        } catch (error) {
            logger.error({ jobId: job.id, statementId, error }, '❌ Parse-statement job failed');

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
                            link: '/statements'
                        }
                    });
                }
            } catch {
                logger.error({ statementId }, 'Failed to update statement error status');
            }

            throw error;
        }
    },
    {
        connection: redisConnection,
        concurrency: 3,
        lockDuration: 600_000,
        lockRenewTime: 300_000,
        removeOnComplete: { count: 100 },
        removeOnFail: { count: 50 },
    }
);

// ─── Generate Report Worker ──────────────────────────────

const generateReportWorker = new Worker(
    'generate-report',
    async (job) => {
        const { workspaceId, userId, userEmail, taxYear } = job.data;
        logger.info({ jobId: job.id, workspaceId }, '📊 Processing generate-report job');

        try {
            const user = await prisma.user.findUnique({ where: { id: userId } });
            const workspace = await prisma.workspace.findUnique({ where: { id: workspaceId } });

            if (!user || !workspace) throw new Error('User or Workspace not found');

            const allTransactions = await prisma.transaction.findMany({
                where: { deletedAt: null, statement: { workspaceId } },
                include: { annotation: true },
                orderBy: { transactionDate: 'asc' }
            });

            let grossIncome = 0n;
            let directBusinessExpenses = 0n;
            let otherExpenses = 0n;
            let totalInflow = 0n;

            for (const tx of allTransactions) {
                const isCredit = tx.creditAmount > 0n;
                const amount = isCredit ? tx.creditAmount : tx.debitAmount;
                const isTaxable = tx.annotation?.taxableStatus === 'YES';
                const taxableAmount = tx.annotation?.taxableAmount || amount;

                if (isCredit) {
                    totalInflow += amount;
                    if (isTaxable) grossIncome += taxableAmount;
                } else {
                    if (isTaxable) directBusinessExpenses += taxableAmount;
                    else otherExpenses += amount;
                }
            }

            const rawDeductions = job.data.additionalDeductions !== undefined ? job.data.additionalDeductions : workspace.additionalDeductions;
            const additionalDeductions = Array.isArray(rawDeductions) ? rawDeductions as { label: string; amount: string }[] : [];
            const reliefs: Relief[] = additionalDeductions.map(d => ({
                label: d.label || 'Additional Deduction',
                amount: BigInt(Math.max(0, parseInt(d.amount, 10) || 0))
            }));

            const taxResult = computeTax({
                grossIncome,
                reliefs,
                taxYear: workspace.taxYear,
                annualRentPaid: job.data.annualRentPaid ? BigInt(job.data.annualRentPaid) : (workspace.annualRentAmount || undefined)
            });

            const templateData = {
                taxYear: workspace.taxYear,
                userName: user.name || user.email,
                professionalCategory: user.professionalCategory || 'N/A',
                tin: user.taxIdentificationNumber || 'Not Provided',
                grossIncome: formatKobo(grossIncome),
                taxLiability: formatKobo(taxResult.taxLiability),
                totalInflow: formatKobo(totalInflow),
                directBusinessExpenses: formatKobo(directBusinessExpenses),
                otherExpenses: formatKobo(otherExpenses),
                taxableIncome: formatKobo(taxResult.taxableIncome),
                totalRelief: formatKobo(taxResult.totalReliefs + taxResult.cra + taxResult.rentRelief),
                months: organizeTransactionsByMonth(allTransactions),
                generatedAt: new Date().toLocaleString(),
                currentYear: new Date().getFullYear(),
            };

            const templatePath = path.join(__dirname, 'templates', 'report.hbs');
            const templateSource = fs.readFileSync(templatePath, 'utf8');
            const template = Handlebars.compile(templateSource);
            const html = template(templateData);

            const browser = await puppeteer.launch({
                executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
                args: ['--no-sandbox', '--disable-setuid-sandbox']
            });
            const page = await browser.newPage();
            await page.setContent(html, { waitUntil: 'networkidle0' });
            const pdfUint8Array = await page.pdf({ format: 'A4', printBackground: true });
            const pdfBuffer = Buffer.from(pdfUint8Array);
            await browser.close();

            // Initialise Resend lazily — only when actually sending
            const resendClient = getResendClient();

            await resendClient.emails.send({
                from: FROM_EMAIL,
                to: userEmail,
                subject: `Your Banklens Self Assessment Report - ${workspace.taxYear}`,
                text: 'Please find attached your self assessment tax report generated by Banklens Nigeria.',
                attachments: [
                    {
                        filename: `Banklens_Tax_Report_${workspace.taxYear}.pdf`,
                        content: pdfBuffer,
                    }
                ]
            });

            logger.info({ jobId: job.id, workspaceId }, '✅ Generate-report job completed successfully');
        } catch (error) {
            logger.error({ jobId: job.id, workspaceId, error }, '❌ Generate-report job failed');
            throw error;
        }
    },
    {
        connection: redisConnection,
        concurrency: 2,
        removeOnComplete: { count: 100 },
        removeOnFail: { count: 50 },
    }
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

logger.info('🔧 Banklens Worker running — waiting for jobs...');