import { adminBillingRouter } from './apps/api/src/routers/admin/billing.js';
import { prisma } from './apps/api/src/db/prisma.js';

async function main() {
  const caller = adminBillingRouter.createCaller({
    prisma,
    admin: { id: 'test', email: 'test@example.com', role: 'SUPER_ADMIN' },
    user: null,
  });
  const data = await caller.getPricingConfig();
  console.log("TRPC Output:", data);
}
main().catch(console.error).finally(() => process.exit(0));
