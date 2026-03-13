import { Queue } from 'bullmq';

// ─── Queues ──────────────────────────────────────────────

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

const parseStatementQueue = new Queue('parse-statement', {
    connection: {
        host: new URL(REDIS_URL).hostname || 'localhost',
        port: Number(new URL(REDIS_URL).port) || 6379,
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
