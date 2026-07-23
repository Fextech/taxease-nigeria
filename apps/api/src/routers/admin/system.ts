import { adminProcedure, router, superAdminProcedure } from '../../trpc/trpc.js';
import { z } from 'zod';
import { S3Client, HeadBucketCommand } from '@aws-sdk/client-s3';

const s3 = new S3Client({
    region: process.env.AWS_REGION || 'af-south-1',
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
    },
});

async function pingUrl(
    url: string,
    method = 'GET',
    headers?: Record<string, string>
): Promise<{ status: string; ping: number }> {
    const start = Date.now();
    try {
        const res = await fetch(url, { method, headers, signal: AbortSignal.timeout(10000) });
        return { status: res.status < 500 ? 'operational' : 'degraded', ping: Date.now() - start };
    } catch {
        return { status: 'down', ping: Date.now() - start };
    }
}

export const adminSystemRouter = router({
    getServiceStatuses: adminProcedure.query(async ({ ctx }) => {
        const statuses = [
            { id: 'api', name: 'Fastify API', status: 'operational', ping: 1, type: 'core' },
            { id: 'web', name: 'Next.js Frontend', status: 'operational', ping: 1, type: 'core' },
        ];

        // 1. Database
        const dbStart = Date.now();
        try {
            await ctx.prisma.$queryRaw`SELECT 1`;
            statuses.push({ id: 'db', name: 'PostgreSQL Db', status: 'operational', ping: Date.now() - dbStart, type: 'infrastructure' });
        } catch {
            statuses.push({ id: 'db', name: 'PostgreSQL Db', status: 'down', ping: Date.now() - dbStart, type: 'infrastructure' });
        }

        // 2. Worker health check (replaces Redis check)
        const workerUrl = process.env.WORKER_URL;
        if (workerUrl) {
            const workerPing = await pingUrl(`${workerUrl}/health`);
            statuses.push({ id: 'worker', name: 'Worker Service', status: workerPing.status, ping: workerPing.ping, type: 'infrastructure' });
        } else {
            statuses.push({ id: 'worker', name: 'Worker Service', status: 'unknown', ping: 0, type: 'infrastructure' });
        }

        // 3. AWS S3
        const s3Start = Date.now();
        try {
            await s3.send(new HeadBucketCommand({ Bucket: process.env.AWS_S3_BUCKET_NAME || 'banklens-statements-dev' }));
            statuses.push({ id: 's3', name: 'AWS S3', status: 'operational', ping: Date.now() - s3Start, type: 'infrastructure' });
        } catch (err: any) {
            const httpStatus = err?.$metadata?.httpStatusCode;
            const s3Status = httpStatus && httpStatus < 500 ? 'degraded' : 'down';
            statuses.push({ id: 's3', name: 'AWS S3', status: s3Status, ping: Date.now() - s3Start, type: 'infrastructure' });
        }

        // 4. Parser API
        let parserUrl = process.env.PARSER_URL || 'http://localhost:8000';
        if (!parserUrl.startsWith('http://') && !parserUrl.startsWith('https://')) {
            parserUrl = `https://${parserUrl}`;
        }
        const parserPing = await pingUrl(parserUrl + '/health');
        statuses.push({ id: 'parser', name: 'Python Parser', status: parserPing.status, ping: parserPing.ping, type: 'core' });

        // 5. Paystack API
        const paystackPing = await pingUrl('https://api.paystack.co/transaction', 'GET', {
            Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
        });
        statuses.push({ id: 'paystack', name: 'Paystack API', status: paystackPing.status, ping: paystackPing.ping, type: 'external' });

        // 6. Resend
        const resendPing = await pingUrl('https://api.resend.com/emails');
        statuses.push({ id: 'resend', name: 'Resend Email', status: resendPing.status, ping: resendPing.ping, type: 'external' });

        return statuses;
    }),

    /**
     * Job queue stats — now derived from DB statement counts instead of BullMQ.
     * active    = PROCESSING
     * completed = READY
     * failed    = ERROR
     * waiting   = UPLOADED (queued but not yet picked up)
     */
    getJobQueueStats: adminProcedure.query(async ({ ctx }) => {
        const [processing, ready, error, uploaded] = await Promise.all([
            ctx.prisma.statement.count({ where: { parseStatus: 'PROCESSING', deletedAt: null } }),
            ctx.prisma.statement.count({ where: { parseStatus: 'READY', deletedAt: null } }),
            ctx.prisma.statement.count({ where: { parseStatus: 'ERROR', deletedAt: null } }),
            ctx.prisma.statement.count({ where: { parseStatus: 'UPLOADED', deletedAt: null } }),
        ]);

        const total = processing + ready + error + uploaded;
        const progressPercent = total === 0 ? 100 : Math.round((ready / total) * 100);

        return {
            active: processing,
            completed: ready,
            failed: error,
            delayed: 0,
            waiting: uploaded,
            progressPercent,
        };
    }),

    getRecentErrors: adminProcedure.query(async ({ ctx }) => {
        const errStatements = await ctx.prisma.statement.findMany({
            where: { parseStatus: 'ERROR' },
            orderBy: { updatedAt: 'desc' },
            take: 5,
            select: { id: true, errorMessage: true, updatedAt: true, originalFilename: true },
        });

        return errStatements.map((err) => ({
            id: err.id,
            service: 'Python Parser',
            message: err.errorMessage || `Failed parsing ${err.originalFilename}`,
            time: err.updatedAt.toISOString(),
        }));
    }),

    getDeploymentInfo: adminProcedure.query(async () => {
        // Cloud Run sets K_REVISION; fall back to a default
        const revision = process.env.K_REVISION || process.env.RAILWAY_GIT_COMMIT_SHA?.substring(0, 7) || 'v1.4.2';
        return {
            version: revision,
            commitHash: revision,
            lastDeployed: new Date().toISOString(),
            environment: process.env.NODE_ENV || 'production',
        };
    }),

    /**
     * Flush stuck PROCESSING statements back to UPLOADED so Cloud Tasks
     * can retry them (or the admin can manually re-trigger).
     * Replaces the old BullMQ flushQueue.
     */
    flushQueue: superAdminProcedure.mutation(async ({ ctx }) => {
        const result = await ctx.prisma.statement.updateMany({
            where: { parseStatus: 'PROCESSING', deletedAt: null },
            data: { parseStatus: 'UPLOADED', errorMessage: null },
        });
        return { success: true, reset: result.count };
    }),
});
