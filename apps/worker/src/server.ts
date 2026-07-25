import Fastify from 'fastify';
import { verifyWorkerSecret } from './lib/auth.js';
import { parseStatementHandler } from './handlers/parse-statement.js';
import { generateReportHandler } from './handlers/generate-report.js';

// Cloud Run injects PORT; default to 8080
const PORT = Number(process.env.PORT) || 8080;

async function main() {
    const fastify = Fastify({
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

    // ── Health check (unauthenticated) ──────────────────
    fastify.get('/health', async () => {
        return { status: 'ok', timestamp: new Date().toISOString() };
    });

    // ── Job routes (require X-Worker-Secret) ────────────

    fastify.post<{ Body: { statementId: string; pdfPassword?: string } }>(
        '/jobs/parse-statement',
        { preHandler: [verifyWorkerSecret] },
        parseStatementHandler
    );

    fastify.post<{
        Body: {
            workspaceId: string;
            userId: string;
            userEmail: string;
            taxYear?: number;
            additionalDeductions?: { label: string; amount: string }[];
            annualRentPaid?: string;
        };
    }>(
        '/jobs/generate-report',
        { preHandler: [verifyWorkerSecret] },
        generateReportHandler
    );

    // ── Graceful shutdown ────────────────────────────────
    const shutdown = async (signal: string) => {
        fastify.log.info(`Received ${signal} — shutting down`);
        await fastify.close();
        process.exit(0);
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));

    // ── Start server ─────────────────────────────────────
    try {
        await fastify.listen({ port: PORT, host: '0.0.0.0' });
        fastify.log.info(`🔧 Banklens Worker HTTP server listening on :${PORT}`);
        fastify.log.info(`📋 Health: GET /health`);
        fastify.log.info(`📄 Parse:  POST /jobs/parse-statement`);
        fastify.log.info(`📊 Report: POST /jobs/generate-report`);
    } catch (err) {
        fastify.log.error(err);
        process.exit(1);
    }
}

main();
