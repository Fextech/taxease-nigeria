import { router, publicProcedure } from '../trpc/trpc.js';
import { workspaceRouter } from './workspace.js';
import { statementsRouter } from './statements.js';
import { annotationsRouter } from './annotations.js';
import { reportsRouter } from './reports.js';
import { dashboardRouter } from './dashboard.js';

export const appRouter = router({
    health: publicProcedure.query(() => {
        return { status: 'ok', timestamp: new Date().toISOString() };
    }),
    workspace: workspaceRouter,
    statements: statementsRouter,
    annotations: annotationsRouter,
    reports: reportsRouter,
    dashboard: dashboardRouter,
});

export type AppRouter = typeof appRouter;
