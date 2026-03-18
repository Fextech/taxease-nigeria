import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { computeTax, type Relief } from '@banklens/shared';
import { Queue } from 'bullmq';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const redisConnection = {
    host: new URL(REDIS_URL).hostname || 'localhost',
    port: Number(new URL(REDIS_URL).port) || 6379,
};

const generateReportQueue = new Queue('generate-report', { connection: redisConnection });

/**
 * POST /api/reports
 *
 * Generates a tax computation report for a workspace using
 * the shared tax engine and aggregated annotation data.
 */
export async function POST(request: Request) {
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { action, ...data } = body;

    try {
        if (action === 'generate') {
            const workspace = await prisma.workspace.findUnique({
                where: { id: data.workspaceId },
            });

            if (!workspace || workspace.userId !== session.user.id) {
                return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
            }

            const taxYear = workspace.taxYear;

            // 1. Aggregate taxable income from COMPLETE annotations (credits only)
            const taxableAnnotations = await prisma.annotation.findMany({
                where: {
                    deletedAt: null,
                    status: 'COMPLETE',
                    taxableStatus: 'YES',
                    transaction: {
                        statement: { workspaceId: data.workspaceId },
                        creditAmount: { gt: 0 },
                    },
                },
                select: {
                    taxableStatus: true,
                    taxableAmount: true,
                    taxCategory: true,
                    transaction: { select: { creditAmount: true } },
                },
            });

            let grossIncome = BigInt(0);
            const categoryTotals: Record<string, bigint> = {};

            for (const ann of taxableAnnotations) {
                const amount = ann.transaction.creditAmount;
                grossIncome += amount;

                const cat = ann.taxCategory || 'UNCLASSIFIED';
                categoryTotals[cat] = (categoryTotals[cat] || BigInt(0)) + amount;
            }

            // 1b. Direct Business Expenses (taxable debits)
            const dbeAnnotations = await prisma.annotation.findMany({
                where: {
                    status: 'COMPLETE',
                    taxableStatus: 'YES',
                    transaction: {
                        statement: { workspaceId: data.workspaceId, deletedAt: null },
                        debitAmount: { gt: 0 },
                    },
                },
                select: {
                    transaction: { select: { debitAmount: true } },
                },
            });

            let totalDBE = BigInt(0);
            for (const ann of dbeAnnotations) {
                totalDBE += ann.transaction.debitAmount;
            }

            // Net taxable = gross income - direct business expenses
            const netTaxableIncome = grossIncome > totalDBE ? grossIncome - totalDBE : BigInt(0);

            // 2. Build reliefs from frontend input OR saved workspace data
            const rawDeductions = data.additionalDeductions !== undefined ? data.additionalDeductions : workspace.additionalDeductions;
            const additionalDeductions = Array.isArray(rawDeductions) ? rawDeductions as { label: string; amount: string }[] : [];
            
            const reliefs: Relief[] = additionalDeductions.map(d => ({
                label: d.label || 'Additional Deduction',
                amount: BigInt(Math.max(0, parseInt(d.amount, 10) || 0))
            }));

            // 3. Compute tax
            const annualRentPaid = data.annualRentPaid ? BigInt(data.annualRentPaid) : (workspace.annualRentAmount || undefined);
            const result = computeTax({ grossIncome: netTaxableIncome, reliefs, taxYear, annualRentPaid });

            // 4. Stats
            const totalTransactions = await prisma.transaction.count({
                where: { deletedAt: null, statement: { workspaceId: data.workspaceId } },
            });
            const annotatedTransactions = await prisma.annotation.count({
                where: {
                    deletedAt: null,
                    status: 'COMPLETE',
                    transaction: { statement: { workspaceId: data.workspaceId } },
                },
            });

            // 5. Serialize BigInt and return
            return NextResponse.json({
                taxYear,
                grossIncome: result.grossIncome.toString(),
                cra: result.cra.toString(),
                rentRelief: result.rentRelief.toString(),
                totalReliefs: result.totalReliefs.toString(),
                taxableIncome: result.taxableIncome.toString(),
                taxLiability: result.taxLiability.toString(),
                effectiveRate: result.effectiveRate,
                minimumTaxApplied: result.minimumTaxApplied,
                breakdown: result.breakdown.map((b) => ({
                    label: b.label,
                    rate: b.rate,
                    taxableInBand: b.taxableInBand.toString(),
                    taxInBand: b.taxInBand.toString(),
                })),
                reliefs: reliefs.map((r) => ({
                    label: r.label,
                    amount: r.amount.toString(),
                })),
                categoryTotals: Object.fromEntries(
                    Object.entries(categoryTotals).map(([k, v]) => [k, v.toString()])
                ),
                stats: {
                    totalTransactions,
                    annotatedTransactions,
                    completionPct: totalTransactions > 0
                        ? Math.round((annotatedTransactions / totalTransactions) * 100)
                        : 0,
                },
                workspaceStatus: workspace.status,
                additionalDeductions,
            });
        }

        if (action === 'email-report') {
            const workspace = await prisma.workspace.findUnique({
                where: { id: data.workspaceId },
            });

            if (!workspace || workspace.userId !== session.user.id) {
                return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
            }

            // Enqueue report generation job
            await generateReportQueue.add('generate-report', {
                workspaceId: data.workspaceId,
                userId: session.user.id,
                userEmail: session.user.email,
                taxYear: workspace.taxYear,
                additionalDeductions: data.additionalDeductions,
                annualRentPaid: data.annualRentPaid,
            });

            return NextResponse.json({ success: true, message: 'Report generation started' });
        }

        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    } catch (error) {
        console.error('Reports API error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
