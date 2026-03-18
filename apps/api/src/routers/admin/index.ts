import { router } from '../../trpc/trpc.js';
import { adminAuthRouter } from './auth.js';
import { adminDashboardRouter } from './dashboard.js';
import { adminUsersRouter } from './users.js';
import { adminBroadcastRouter } from './broadcast.js';
import { adminBillingRouter } from './billing.js';
import { adminSupportRouter } from './support.js';
import { adminSystemRouter } from './system.js';
import { adminAuditRouter } from './audit.js';
import { adminSettingsRouter } from './settings.js';
import { adminAnalyticsRouter } from './analytics.js';

export const adminRouter = router({
    auth: adminAuthRouter,
    dashboard: adminDashboardRouter,
    users: adminUsersRouter,
    broadcast: adminBroadcastRouter,
    billing: adminBillingRouter,
    support: adminSupportRouter,
    system: adminSystemRouter,
    audit: adminAuditRouter,
    settings: adminSettingsRouter,
    analytics: adminAnalyticsRouter,
});

export type AdminRouter = typeof adminRouter;
