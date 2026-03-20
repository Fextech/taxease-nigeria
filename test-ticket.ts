import { adminSupportRouter } from './apps/api/src/routers/admin/support.js';
import { prisma } from './apps/api/src/db/prisma.js';

async function main() {
  const caller = adminSupportRouter.createCaller({
    prisma,
    admin: { id: 'test', email: 'test@example.com', role: 'SUPER_ADMIN' },
    user: null,
  });
  
  // Get latest ticket id
  const tickets = await prisma.supportTicket.findMany({ take: 1, orderBy: { createdAt: 'desc' } });
  if (!tickets.length) { console.log('No tickets found'); return; }
  const ticketId = tickets[0].id;
  console.log('Fetching ticket details for:', ticketId);

  try {
      const data = await caller.getTicketDetails({ ticketId });
      console.log("TRPC Output:", data);
  } catch (error) {
      console.error("TRPC Error:", error);
  }
}
main().catch(console.error).finally(() => process.exit(0));
