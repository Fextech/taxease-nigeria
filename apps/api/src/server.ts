import Fastify from 'fastify';
import cors from '@fastify/cors';
import {
    fastifyTRPCPlugin,
    type FastifyTRPCPluginOptions,
} from '@trpc/server/adapters/fastify';
import { PrismaClient } from '@prisma/client';
import { createContext } from './trpc/context.js';
import { appRouter, type AppRouter } from './routers/index.js';
import { startScheduledBroadcastPoller } from './routers/admin/broadcast.js';
import { getAdminJwtSecret } from './lib/admin-jwt.js';
import { verifyInternalApiSecret } from './lib/internal-auth.js';
import { enqueueParseJob, enqueueReportJob } from './services/queue.service.js';

// Cloud Run supplies PORT. API_PORT remains a convenient local override.
const PORT = Number(process.env.PORT || process.env.API_PORT) || 3001;

async function getParserAuthorizationHeader(parserUrl: string): Promise<Record<string, string>> {
    if (!process.env.K_SERVICE) {
        return {};
    }

    const audience = parserUrl.replace(/\/+$/, '');
    const metadataResponse = await fetch(
        'http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/identity'
        + `?audience=${encodeURIComponent(audience)}`,
        { headers: { 'Metadata-Flavor': 'Google' } }
    );

    if (!metadataResponse.ok) {
        throw new Error(`Unable to obtain parser identity token (${metadataResponse.status}).`);
    }

    return { Authorization: `Bearer ${await metadataResponse.text()}` };
}

async function main() {
    // Fail fast on boot if admin JWT signing is misconfigured.
    getAdminJwtSecret();

    const fastify = Fastify({
        maxParamLength: 10000,
        logger: {
            transport: {
                target: 'pino-pretty',
                options: {
                    translateTime: 'HH:MM:ss Z',
                    ignore: 'pid,hostname',
                },
            },
        },
    });

    // CORS — allow frontend origins
    const allowedOrigins = [
        process.env.APP_URL || 'http://localhost:3000',
        process.env.ADMIN_URL || 'http://localhost:3002',
    ];
    await fastify.register(cors, {
        origin: allowedOrigins,
        credentials: true,
    });

    // The web server forwards password-check uploads as an untouched multipart
    // stream. Keep it as a stream here too, so the parser receives the original
    // boundary and bytes rather than a reconstructed file.
    fastify.addContentTypeParser('multipart/form-data', (request, payload, done) => {
        done(null, payload);
    });

    // Health check
    fastify.get('/health', async () => {
        return { status: 'ok', timestamp: new Date().toISOString() };
    });

    // The web application is hosted outside GCP. It authenticates to these
    // internal endpoints with a shared secret; this Cloud Run service then
    // creates the Cloud Task with its attached dispatcher service account.
    fastify.post<{ Body: { statementId?: string; pdfPassword?: string } }>(
        '/internal/jobs/parse-statement',
        { preHandler: [verifyInternalApiSecret] },
        async (request, reply) => {
            if (!request.body?.statementId) {
                return reply.code(400).send({ error: 'statementId is required.' });
            }

            try {
                await enqueueParseJob(request.body.statementId, request.body.pdfPassword);
                return reply.code(202).send({ accepted: true });
            } catch (error) {
                request.log.error({ error }, 'Failed to create parse-statement Cloud Task');
                return reply.code(503).send({ error: 'Unable to create parse-statement task.' });
            }
        }
    );

    fastify.post<{ Body: NodeJS.ReadableStream }>(
        '/internal/statements/check-password',
        { preHandler: [verifyInternalApiSecret] },
        async (request, reply) => {
            let parserUrl = process.env.PARSER_URL || 'http://127.0.0.1:8000';
            if (!parserUrl.startsWith('http://') && !parserUrl.startsWith('https://')) {
                parserUrl = `https://${parserUrl}`;
            }

            try {
                const authHeaders = await getParserAuthorizationHeader(parserUrl);
                const parserResponse = await fetch(`${parserUrl}/check-password`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': request.headers['content-type'] || 'multipart/form-data',
                        ...authHeaders,
                    },
                    body: request.body as unknown as BodyInit,
                    // Required by Node.js fetch for a streaming request body.
                    // @ts-expect-error The DOM type definitions omit Node's duplex option.
                    duplex: 'half',
                    signal: AbortSignal.timeout(15_000),
                });

                const responseText = await parserResponse.text();
                return reply
                    .code(parserResponse.status)
                    .header('Content-Type', parserResponse.headers.get('content-type') || 'application/json')
                    .send(responseText);
            } catch (error) {
                request.log.error({ error }, 'Failed to proxy password validation to parser');
                return reply.code(503).send({ valid: false, error: 'Password validation service is unavailable.' });
            }
        }
    );

    fastify.post<{
        Body: {
            workspaceId?: string;
            userId?: string;
            userEmail?: string;
            taxYear?: number;
            additionalDeductions?: { label: string; amount: string }[];
            annualRentPaid?: string;
        };
    }>(
        '/internal/jobs/generate-report',
        { preHandler: [verifyInternalApiSecret] },
        async (request, reply) => {
            const { workspaceId, userId, userEmail, taxYear, additionalDeductions, annualRentPaid } = request.body || {};
            if (!workspaceId || !userId || !userEmail) {
                return reply.code(400).send({ error: 'workspaceId, userId, and userEmail are required.' });
            }

            try {
                await enqueueReportJob({ workspaceId, userId, userEmail, taxYear, additionalDeductions, annualRentPaid });
                return reply.code(202).send({ accepted: true });
            } catch (error) {
                request.log.error({ error }, 'Failed to create generate-report Cloud Task');
                return reply.code(503).send({ error: 'Unable to create generate-report task.' });
            }
        }
    );

    // tRPC adapter
    await fastify.register(fastifyTRPCPlugin, {
        prefix: '/trpc',
        trpcOptions: {
            router: appRouter,
            createContext,
        } satisfies FastifyTRPCPluginOptions<AppRouter>['trpcOptions'],
    });

    // Start server
    try {
        await fastify.listen({ port: PORT, host: '0.0.0.0' });
        fastify.log.info(`🚀 Banklens API running at http://localhost:${PORT}`);
        fastify.log.info(`📋 Health check: http://localhost:${PORT}/health`);
        fastify.log.info(`🔌 tRPC endpoint: http://localhost:${PORT}/trpc`);

        // Start the scheduled broadcast poller
        const prisma = new PrismaClient();
        startScheduledBroadcastPoller(prisma);
    } catch (err) {
        fastify.log.error(err);
        process.exit(1);
    }
}

main();
