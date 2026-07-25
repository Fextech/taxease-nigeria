import { timingSafeEqual } from 'node:crypto';
import type { FastifyReply, FastifyRequest } from 'fastify';

/** Verifies calls from the web server to API-only operational endpoints. */
export async function verifyInternalApiSecret(
    request: FastifyRequest,
    reply: FastifyReply
): Promise<void> {
    const configured = process.env.INTERNAL_API_SECRET;
    const incoming = request.headers['x-internal-api-secret'];

    if (!configured || configured.length < 32) {
        request.log.error('INTERNAL_API_SECRET is not configured');
        reply.code(503).send({ error: 'Internal API dispatch is not configured.' });
        return;
    }

    if (typeof incoming !== 'string') {
        reply.code(401).send({ error: 'Unauthorized' });
        return;
    }

    const expected = Buffer.from(configured);
    const actual = Buffer.from(incoming);
    if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
        reply.code(401).send({ error: 'Unauthorized' });
    }
}
