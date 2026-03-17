import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import {
    WORKSPACE_UNLOCK_PRICE,
    ADDITIONAL_BANK_PRICE,
    CREDIT_PACKAGES,
    STANDARD_STATEMENT_CREDITS,
} from '@banklens/shared';

async function initializePaystackTransaction(opts: {
    email: string;
    amountKobo: bigint;
    reference: string;
    metadata?: Record<string, unknown>;
    callbackUrl?: string;
}) {
    const secretKey = process.env.PAYSTACK_SECRET_KEY;
    if (!secretKey) {
        throw new Error('PAYSTACK_SECRET_KEY is not configured');
    }

    const res = await fetch('https://api.paystack.co/transaction/initialize', {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${secretKey}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            email: opts.email,
            amount: Number(opts.amountKobo),
            reference: opts.reference,
            metadata: opts.metadata || {},
            callback_url: opts.callbackUrl,
        }),
    });

    const data = await res.json();
    if (!data.status) {
        throw new Error(data.message || 'Failed to initialize Paystack transaction');
    }

    return {
        authorizationUrl: data.data.authorization_url as string,
        accessCode: data.data.access_code as string,
        reference: data.data.reference as string,
    };
}

function generateReference(type: string): string {
    const ts = Date.now().toString(36);
    const rand = Math.random().toString(36).substring(2, 8);
    return `bl_${type}_${ts}_${rand}`;
}

export async function POST(request: Request) {
    const session = await auth();

    if (!session?.user?.id || !session?.user?.email) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.user.id;
    const email = session.user.email;
    const body = await request.json();
    const { action, ...data } = body;

    try {
        if (action === 'unlockWorkspace') {
            const workspaceId = data.workspaceId;
            const workspace = await prisma.workspace.findUnique({ where: { id: workspaceId } });

            if (!workspace || workspace.userId !== userId) {
                return NextResponse.json({ error: 'Workspace not found.' }, { status: 404 });
            }
            if (workspace.isUnlocked) {
                return NextResponse.json({ error: 'Workspace is already unlocked.' }, { status: 400 });
            }

            const totalKobo = WORKSPACE_UNLOCK_PRICE.priceKobo;
            const reference = generateReference('unlock');

            await prisma.paystackTransaction.create({
                data: {
                    userId,
                    reference,
                    amount: totalKobo,
                    status: 'pending',
                    type: 'workspace_unlock',
                    metadata: { workspaceId },
                },
            });

            const paystack = await initializePaystackTransaction({
                email,
                amountKobo: totalKobo,
                reference,
                callbackUrl: data.callbackUrl,
                metadata: { type: 'workspace_unlock', workspaceId },
            });

            return NextResponse.json({ authorizationUrl: paystack.authorizationUrl });
        }

        if (action === 'purchaseCredits') {
            const workspaceId = data.workspaceId;
            const credits = data.credits || 10;
            const workspace = await prisma.workspace.findUnique({ where: { id: workspaceId } });

            if (!workspace || workspace.userId !== userId) {
                return NextResponse.json({ error: 'Workspace not found.' }, { status: 404 });
            }

            const basePackage = CREDIT_PACKAGES[0];
            const totalKobo = basePackage.perCreditKobo * BigInt(credits);
            const reference = generateReference('credits');

            await prisma.paystackTransaction.create({
                data: {
                    userId,
                    reference,
                    amount: totalKobo,
                    status: 'pending',
                    type: 'credit_purchase',
                    metadata: { workspaceId, credits },
                },
            });

            const paystack = await initializePaystackTransaction({
                email,
                amountKobo: totalKobo,
                reference,
                callbackUrl: data.callbackUrl,
                metadata: { type: 'credit_purchase', workspaceId, credits },
            });

            return NextResponse.json({ authorizationUrl: paystack.authorizationUrl });
        }

        if (action === 'addBankAccount') {
            const workspaceId = data.workspaceId;
            const workspace = await prisma.workspace.findUnique({ where: { id: workspaceId } });

            if (!workspace || workspace.userId !== userId) {
                return NextResponse.json({ error: 'Workspace not found.' }, { status: 404 });
            }

            const reference = generateReference('bank');

            await prisma.paystackTransaction.create({
                data: {
                    userId,
                    reference,
                    amount: ADDITIONAL_BANK_PRICE.priceKobo,
                    status: 'pending',
                    type: 'bank_addon',
                    metadata: { workspaceId },
                },
            });

            const paystack = await initializePaystackTransaction({
                email,
                amountKobo: ADDITIONAL_BANK_PRICE.priceKobo,
                reference,
                callbackUrl: data.callbackUrl,
                metadata: { type: 'bank_addon', workspaceId },
            });

            return NextResponse.json({ authorizationUrl: paystack.authorizationUrl });
        }

        if (action === 'verifyPayment') {
            const reference = data.reference;
            const txn = await prisma.paystackTransaction.findUnique({ where: { reference } });

            if (!txn) {
                return NextResponse.json({ error: 'Transaction not found.' }, { status: 404 });
            }
            if (txn.status === 'success') {
                return NextResponse.json({ status: 'already_verified' });
            }

            const secretKey = process.env.PAYSTACK_SECRET_KEY;
            const res = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
                headers: { Authorization: `Bearer ${secretKey}` },
            });
            const paystackData = await res.json();

            if (!paystackData.status || paystackData.data.status !== 'success') {
                await prisma.paystackTransaction.update({
                    where: { reference },
                    data: { status: 'failed', paystackData: paystackData.data },
                });
                return NextResponse.json({ error: 'Payment verification failed.' }, { status: 400 });
            }

            const meta = txn.metadata as Record<string, unknown>;

            // Use a transaction or optimistic update to ensure we only process if still pending
            const updateResult = await prisma.paystackTransaction.updateMany({
                where: { reference, status: 'pending' },
                data: { status: 'success', paystackData: paystackData.data },
            });

            if (updateResult.count === 0) {
               // Another request already processed it
               return NextResponse.json({ status: 'already_verified' });
            }

            if (txn.type === 'workspace_unlock') {
                await prisma.workspace.update({
                    where: { id: meta.workspaceId as string },
                    data: { 
                        isUnlocked: true, 
                        statementCredits: { increment: STANDARD_STATEMENT_CREDITS } 
                    },
                });
            } else if (txn.type === 'credit_purchase') {
                const credits = meta.credits as number;
                await prisma.workspace.update({
                    where: { id: meta.workspaceId as string },
                    data: { statementCredits: { increment: credits } },
                });
                await prisma.creditPurchase.create({
                    data: {
                        workspaceId: meta.workspaceId as string,
                        credits,
                        amountPaid: txn.amount,
                        paystackRef: reference,
                    },
                });
            } else if (txn.type === 'bank_addon') {
                await prisma.workspace.update({
                    where: { id: meta.workspaceId as string },
                    data: { allowedBanksCount: { increment: 1 } },
                });
            }

            return NextResponse.json({ status: 'success', type: txn.type });
        }

        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    } catch (error: unknown) {
        return NextResponse.json({ error: (error as Error).message || 'Internal server error' }, { status: 500 });
    }
}
