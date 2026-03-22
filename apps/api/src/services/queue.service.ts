import { Queue } from 'bullmq';

// ─── Queues ──────────────────────────────────────────────

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const parsedUrl = new URL(REDIS_URL);

const parseStatementQueue = new Queue('parse-statement', {
    connection: {
        host: parsedUrl.hostname,
        port: Number(parsedUrl.port) || 6379,
        password: parsedUrl.password || undefined,
        tls: REDIS_URL.startsWith('rediss://') ? {} : undefined,
        maxRetriesPerRequest: null,
        enableReadyCheck: false,
    },
});

/**
 * Enqueue a parse-statement job for the worker to process.
 */
export async function enqueueParseJob(statementId: string) {
    return parseStatementQueue.add(
        'parse',
        { statementId },
        {
            attempts: 3,
            backoff: {
                type: 'exponential',
                delay: 5000,
            },
            removeOnComplete: 100,
            removeOnFail: 200,
        }
    );
}