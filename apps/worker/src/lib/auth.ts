import type { FastifyRequest, FastifyReply } from 'fastify';

const WORKER_SECRET = process.env.WORKER_SECRET;

if (!WORKER_SECRET || WORKER_SECRET.length < 32) {
    throw new Error(
        '[FATAL] WORKER_SECRET env var is not set or too short (minimum 32 chars). ' +
        'Generate one with: openssl rand -hex 32'
    );
}

/**
 * Fastify preHandler — verifies X-Worker-Secret header.
 * Cloud Tasks (and any internal caller) must include this header.
 * Returns 401 if missing or wrong; lets the request through otherwise.
 */
export async function verifyWorkerSecret(
    request: FastifyRequest,
    reply: FastifyReply
): Promise<void> {
    const incoming = request.headers['x-worker-secret'];
    if (incoming !== WORKER_SECRET) {
        reply.code(401).send({ error: 'Unauthorized' });
    }
}
