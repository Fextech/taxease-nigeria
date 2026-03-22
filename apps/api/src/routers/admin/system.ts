import { adminProcedure, router, superAdminProcedure } from '../../trpc/trpc.js';
import { z } from 'zod';
import { Queue } from 'bullmq';
import { S3Client, HeadBucketCommand } from '@aws-sdk/client-s3';

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

const parseQueue = new Queue('parse-statement', { connection: redisConnection });

const s3 = new S3Client({
    region: process.env.AWS_REGION || 'af-south-1',
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
    },
});

async function pingUrl(url: string, method = 'GET', headers?: Record<string, string>): Promise<{ status: string, ping: number }> {
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

        // 2. Redis — ping via BullMQ client
        const redisStart = Date.now();
        try {
            const client = await parseQueue.client;
            await client.ping();
            statuses.push({ id: 'redis', name: 'Redis Cache', status: 'operational', ping: Date.now() - redisStart, type: 'infrastructure' });
        } catch {
            statuses.push({ id: 'redis', name: 'Redis Cache', status: 'down', ping: Date.now() - redisStart, type: 'infrastructure' });
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
        const paystackPing = await pingUrl('https://api.paystack.co/transaction', 'GET', { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}` });
        statuses.push({ id: 'paystack', name: 'Paystack API', status: paystackPing.status, ping: paystackPing.ping, type: 'external' });

        // 6. Resend
        const resendPing = await pingUrl('https://api.resend.com/emails');
        statuses.push({ id: 'resend', name: 'Resend Email', status: resendPing.status, ping: resendPing.ping, type: 'external' });

        return statuses;
    }),

    getJobQueueStats: adminProcedure.query(async () => {
        const [active, completed, failed, delayed, waiting] = await Promise.all([
            parseQueue.getActiveCount(),
            parseQueue.getCompletedCount(),
            parseQueue.getFailedCount(),
            parseQueue.getDelayedCount(),
            parseQueue.getWaitingCount(),
        ]);

        const total = active + completed + failed + delayed + waiting;
        const progressPercent = total === 0 ? 100 : Math.round((completed / total) * 100);

        return {
            active,
            completed,
            failed,
            delayed,
            waiting,
            progressPercent,
        };
    }),

    getRecentErrors: adminProcedure.query(async ({ ctx }) => {
        const errStatements = await ctx.prisma.statement.findMany({
            where: { parseStatus: 'ERROR' },
            orderBy: { updatedAt: 'desc' },
            take: 5,
            select: { id: true, errorMessage: true, updatedAt: true, originalFilename: true }
        });

        return errStatements.map(err => ({
            id: err.id,
            service: 'Python Parser',
            message: err.errorMessage || `Failed parsing ${err.originalFilename}`,
            time: err.updatedAt.toISOString(),
        }));
    }),

    getDeploymentInfo: adminProcedure.query(async () => {
        return {
            version: process.env.RAILWAY_GIT_COMMIT_SHA ? process.env.RAILWAY_GIT_COMMIT_SHA.substring(0, 7) : 'v1.4.2',
            commitHash: process.env.RAILWAY_GIT_COMMIT_SHA ? process.env.RAILWAY_GIT_COMMIT_SHA.substring(0, 7) : 'a83b9c2',
            lastDeployed: new Date().toISOString(),
            environment: process.env.NODE_ENV || 'production'
        };
    }),

    flushQueue: superAdminProcedure.mutation(async () => {
        await parseQueue.clean(0, 1000, 'failed');
        return { success: true };
    })
});
