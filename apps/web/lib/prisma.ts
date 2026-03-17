import { PrismaClient } from "@prisma/client";
import { createSoftDeleteClient } from "./prisma-soft-delete";

const globalForPrisma = globalThis as unknown as {
  prisma: ReturnType<typeof createSoftDeleteClient> | undefined;
};

const basePrisma = new PrismaClient();
export const prisma = globalForPrisma.prisma ?? createSoftDeleteClient(basePrisma);

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
