import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { computeTax, type Relief } from '@taxease/shared';

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

            const taxYear = data.taxYear || 2023;

            // 1. Aggregate taxable income from COMPLETE annotations
            const taxableAnnotations = await prisma.annotation.findMany({
                where: {
                    status: 'COMPLETE',
                    taxableStatus: { in: ['YES', 'PARTIAL'] },
                    transaction: { statement: { workspaceId: data.workspaceId } },
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
                let amount: bigint;
                if (ann.taxableStatus === 'PARTIAL' && ann.taxableAmount != null) {
                    amount = ann.taxableAmount;
                } else {
                    amount = ann.transaction.creditAmount;
                }
                grossIncome += amount;

                const cat = ann.taxCategory || 'UNCLASSIFIED';
                categoryTotals[cat] = (categoryTotals[cat] || BigInt(0)) + amount;
            }

            // 2. Build reliefs
            const reliefs: Relief[] = [];
            const pensionAmount = (grossIncome * BigInt(8)) / BigInt(100);
            if (pensionAmount > BigInt(0)) {
                reliefs.push({ label: 'Pension Fund (RSA) — 8%', amount: pensionAmount });
            }
            const nhfAmount = (grossIncome * BigInt(25)) / BigInt(1000);
            if (nhfAmount > BigInt(0)) {
                reliefs.push({ label: 'National Housing Fund (NHF) — 2.5%', amount: nhfAmount });
            }

            // 3. Compute tax
            const result = computeTax({ grossIncome, reliefs, taxYear });

            // 4. Stats
            const totalTransactions = await prisma.transaction.count({
                where: { statement: { workspaceId: data.workspaceId } },
            });
            const annotatedTransactions = await prisma.annotation.count({
                where: {
                    status: 'COMPLETE',
                    transaction: { statement: { workspaceId: data.workspaceId } },
                },
            });

            // 5. Serialize BigInt and return
            return NextResponse.json({
                taxYear,
                grossIncome: result.grossIncome.toString(),
                cra: result.cra.toString(),
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
            });
        }

        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    } catch (error) {
        console.error('Reports API error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
