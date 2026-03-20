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

const PORT = Number(process.env.API_PORT) || 3001;

async function main() {
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

    // Health check
    fastify.get('/health', async () => {
        return { status: 'ok', timestamp: new Date().toISOString() };
    });

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
