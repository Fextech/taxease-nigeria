import { PrismaClient } from '@prisma/client';
import { createSoftDeleteClient } from '../lib/prisma-soft-delete';

const globalForPrisma = globalThis as unknown as {
    prisma: ReturnType<typeof createSoftDeleteClient> | undefined;
};

const basePrisma = new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
});

export const prisma = globalForPrisma.prisma ?? createSoftDeleteClient(basePrisma);

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
