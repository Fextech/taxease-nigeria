import { router, publicProcedure } from '../trpc/trpc.js';
import { workspaceRouter } from './workspace.js';
import { statementsRouter } from './statements.js';
import { annotationsRouter } from './annotations.js';
import { reportsRouter } from './reports.js';
import { dashboardRouter } from './dashboard.js';
import { billingRouter } from './billing.js';
import { adminRouter } from './admin/index.js';

export const appRouter = router({
    health: publicProcedure.query(() => {
        return { status: 'ok', timestamp: new Date().toISOString() };
    }),
    workspace: workspaceRouter,
    statements: statementsRouter,
    annotations: annotationsRouter,
    reports: reportsRouter,
    dashboard: dashboardRouter,
    billing: billingRouter,
    admin: adminRouter,
});

export type AppRouter = typeof appRouter;
