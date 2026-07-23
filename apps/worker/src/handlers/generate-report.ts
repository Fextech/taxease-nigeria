import type { FastifyRequest, FastifyReply } from 'fastify';
import pino from 'pino';
import { PrismaClient } from '@prisma/client';
import { Resend } from 'resend';
import Handlebars from 'handlebars';
import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';
import { computeTax, type Relief } from '@banklens/shared';
import { formatKobo, organizeTransactionsByMonth } from '../lib/utils.js';

const logger = pino({
    transport: {
        target: 'pino-pretty',
        options: { translateTime: 'HH:MM:ss Z', ignore: 'pid,hostname' },
    },
});

const prisma = new PrismaClient();

const rawEmailFrom = process.env.EMAIL_FROM || 'onboarding@resend.dev';
const senderName = process.env.SENDER_NAME || 'Banklens Nigeria';
const FROM_EMAIL = rawEmailFrom.includes('<')
    ? rawEmailFrom
    : `${senderName} <${rawEmailFrom}>`;

function getResendClient(): Resend {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) throw new Error('RESEND_API_KEY environment variable is not set');
    return new Resend(apiKey);
}

// ─── Request body type ───────────────────────────────────

interface GenerateReportBody {
    workspaceId: string;
    userId: string;
    userEmail: string;
    taxYear?: number;
    additionalDeductions?: { label: string; amount: string }[];
    annualRentPaid?: string;
}

// ─── Handler ─────────────────────────────────────────────

/**
 * POST /jobs/generate-report
 *
 * Called by Google Cloud Tasks to generate a PDF tax report and email it.
 * Returns:
 *   200 — success
 *   422 — unprocessable / missing data (no retry)
 *   500 — transient error (Cloud Tasks retries)
 */
export async function generateReportHandler(
    request: FastifyRequest<{ Body: GenerateReportBody }>,
    reply: FastifyReply
): Promise<void> {
    const { workspaceId, userId, userEmail, additionalDeductions, annualRentPaid } = request.body;

    if (!workspaceId || !userId || !userEmail) {
        reply.code(422).send({ error: 'Missing required fields: workspaceId, userId, userEmail' });
        return;
    }

    logger.info({ workspaceId }, '📊 Processing generate-report job');

    try {
        const user = await prisma.user.findUnique({ where: { id: userId } });
        const workspace = await prisma.workspace.findUnique({ where: { id: workspaceId } });

        if (!user || !workspace) {
            reply.code(422).send({ error: 'User or Workspace not found' });
            return;
        }

        const allTransactions = await prisma.transaction.findMany({
            where: { deletedAt: null, statement: { workspaceId } },
            include: { annotation: true },
            orderBy: { transactionDate: 'asc' },
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

        const rawDeductions =
            additionalDeductions !== undefined
                ? additionalDeductions
                : workspace.additionalDeductions;
        const deductions = Array.isArray(rawDeductions)
            ? (rawDeductions as { label: string; amount: string }[])
            : [];

        const reliefs: Relief[] = deductions.map((d) => ({
            label: d.label || 'Additional Deduction',
            amount: BigInt(Math.max(0, parseInt(d.amount, 10) || 0)),
        }));

        const netTaxableIncome =
            grossIncome > directBusinessExpenses
                ? grossIncome - directBusinessExpenses
                : 0n;

        const taxResult = computeTax({
            grossIncome: netTaxableIncome,
            reliefs,
            taxYear: workspace.taxYear,
            annualRentPaid: annualRentPaid
                ? BigInt(annualRentPaid)
                : workspace.annualRentAmount || undefined,
        });

        const templateData = {
            taxYear: workspace.taxYear,
            userName: user.name || user.email,
            professionalCategory: user.professionalCategory || 'N/A',
            tin: user.taxIdentificationNumber || 'Not Provided',
            grossIncome: formatKobo(netTaxableIncome),
            taxLiability: formatKobo(taxResult.taxLiability),
            totalInflow: formatKobo(totalInflow),
            directBusinessExpenses: formatKobo(directBusinessExpenses),
            otherExpenses: formatKobo(otherExpenses),
            taxableIncome: formatKobo(taxResult.taxableIncome),
            totalRelief: formatKobo(
                taxResult.totalReliefs + taxResult.cra + taxResult.rentRelief
            ),
            months: organizeTransactionsByMonth(allTransactions),
            generatedAt: new Date().toLocaleString(),
            currentYear: new Date().getFullYear(),
        };

        // ── Build PDF ──────────────────────────────────────
        // In CJS (nodenext without "type":"module"), __dirname is available natively.
        // Templates are at dist/templates/ relative to dist/handlers/ → go up two levels.
        const templatePath = path.join(__dirname, '..', 'templates', 'report.hbs');
        const templateSource = fs.readFileSync(templatePath, 'utf8');
        const template = Handlebars.compile(templateSource);
        const html = template(templateData);

        const browser = await puppeteer.launch({
            executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage', // Required on Cloud Run
                '--disable-gpu',
            ],
        });
        const page = await browser.newPage();
        await page.setContent(html, { waitUntil: 'networkidle0' });
        const pdfUint8Array = await page.pdf({ format: 'A4', printBackground: true });
        const pdfBuffer = Buffer.from(pdfUint8Array);
        await browser.close();

        // ── Email PDF ──────────────────────────────────────
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
                },
            ],
        });

        logger.info({ workspaceId }, '✅ generate-report completed');
        reply.code(200).send({ success: true });
    } catch (error) {
        logger.error({ workspaceId, error }, '❌ generate-report failed');
        // Return 500 — Cloud Tasks retries
        reply.code(500).send({
            error: error instanceof Error ? error.message : String(error),
        });
    }
}
