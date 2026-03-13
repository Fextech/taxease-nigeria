import { z } from 'zod';

// ─── Tax Year Validation ─────────────────────────────────
const EARLIEST_YEAR = 2020;
const LATEST_YEAR = 2030;

// ─── Create Workspace ────────────────────────────────────
export const createWorkspaceSchema = z.object({
    taxYear: z
        .number()
        .int()
        .min(EARLIEST_YEAR, `Tax year must be ${EARLIEST_YEAR} or later`)
        .max(LATEST_YEAR, `Tax year must be ${LATEST_YEAR} or earlier`),
});

export type CreateWorkspaceInput = z.infer<typeof createWorkspaceSchema>;

// ─── Lock Workspace ──────────────────────────────────────
export const lockWorkspaceSchema = z.object({
    workspaceId: z.string().cuid(),
});

export type LockWorkspaceInput = z.infer<typeof lockWorkspaceSchema>;

// ─── Workspace Status ────────────────────────────────────
export const workspaceStatusSchema = z.enum(['ACTIVE', 'LOCKED', 'FILED']);

export type WorkspaceStatus = z.infer<typeof workspaceStatusSchema>;
