import { adminProcedure, router } from '../../trpc/trpc.js';
import { z } from 'zod';

export const adminSystemRouter = router({
    getServiceStatuses: adminProcedure.query(async ({ ctx }) => {
        // Ping database
        let dbStatus = 'operational';
        try {
            await ctx.prisma.$queryRaw`SELECT 1`;
        } catch (e) {
            dbStatus = 'down';
        }

        // Return statuses for the 10 services
        return [
            { id: 'api', name: 'Fastify API', status: 'operational', ping: 32, type: 'core' },
            { id: 'web', name: 'Next.js Frontend', status: 'operational', ping: 45, type: 'core' },
            { id: 'worker', name: 'BullMQ Worker', status: 'operational', ping: 12, type: 'core' },
            { id: 'parser', name: 'Python Parser', status: 'operational', ping: 156, type: 'core' },
            { id: 'db', name: 'PostgreSQL Db', status: dbStatus, ping: 18, type: 'infrastructure' },
            { id: 'redis', name: 'Redis Cache', status: 'operational', ping: 4, type: 'infrastructure' },
            { id: 's3', name: 'AWS S3', status: 'operational', ping: 89, type: 'infrastructure' },
            { id: 'paystack', name: 'Paystack API', status: 'operational', ping: 210, type: 'external' },
            { id: 'resend', name: 'Resend Email', status: 'operational', ping: 315, type: 'external' },
            { id: 'gemini', name: 'Google AI', status: 'degraded', ping: 850, type: 'external' },
        ];
    }),

    getJobQueueStats: adminProcedure.query(async () => {
        // Mocking BullMQ stats for the dashboard UI
        return {
            active: 14,
            completed: 12450,
            failed: 23,
            delayed: 0,
            waiting: 56,
            progressPercent: 85, // mock progress of current batch
        };
    }),

    getRecentErrors: adminProcedure.query(async () => {
        // Mocking recent errors from Sentry/Logger
        return [
            { id: 'err_1', service: 'Python Parser', message: 'PDF extraction timeout on zenith_statement.pdf', time: new Date(Date.now() - 15 * 60000).toISOString() },
            { id: 'err_2', service: 'Fastify API', message: 'Paystack webhook verification failed', time: new Date(Date.now() - 45 * 60000).toISOString() },
            { id: 'err_3', service: 'Google AI', message: 'Rate limit exceeded (HTTP 429)', time: new Date(Date.now() - 120 * 60000).toISOString() },
        ];
    }),

    getDeploymentInfo: adminProcedure.query(async () => {
        return {
            version: 'v1.4.2',
            commitHash: 'a83b9c2',
            lastDeployed: new Date(Date.now() - 3 * 86400000).toISOString(),
            environment: 'production'
        };
    }),

    flushQueue: adminProcedure.mutation(async ({ ctx }) => {
        // Only SUPER_ADMIN can do this
        if (ctx.admin.role !== 'SUPER_ADMIN') {
            throw new Error('Unauthorized');
        }
        return { success: true };
    })
});
