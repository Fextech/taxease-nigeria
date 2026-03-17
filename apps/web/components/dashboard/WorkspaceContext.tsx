"use client";

/**
 * WorkspaceContext — backward-compatible wrapper around the Zustand workspace store.
 *
 * The `useWorkspace()` hook is used throughout the dashboard.
 * This module delegates to `useWorkspaceStore` from `@/stores/workspace-store`
 * so consumers don't need to change their imports.
 *
 * The WorkspaceProvider is kept as a thin initialiser — it triggers the
 * initial fetch on mount.  Zustand doesn't need a React context provider,
 * but we keep this component so the dashboard layout can call it once.
 */

import { useEffect } from "react";
import { useWorkspaceStore, type Workspace } from "@/stores/workspace-store";

// ─── Public hook (drop-in replacement for the old useContext) ──
export function useWorkspace() {
  const workspaces = useWorkspaceStore((s) => s.workspaces);
  const activeWorkspaceId = useWorkspaceStore((s) => s.activeWorkspaceId);
  const loading = useWorkspaceStore((s) => s.loading);
  const setActiveWorkspaceId = useWorkspaceStore((s) => s.setActiveWorkspaceId);
  const refresh = useWorkspaceStore((s) => s.refresh);

  const activeWorkspace =
    workspaces.find((w) => w.id === activeWorkspaceId) || null;

  return {
    workspaces,
    activeWorkspaceId,
    activeWorkspace,
    setActiveWorkspaceId,
    loading,
    refresh,
  };
}

// ─── Initialiser component (replaces the old Provider) ────────
export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const fetchWorkspaces = useWorkspaceStore((s) => s.fetchWorkspaces);

  useEffect(() => {
    fetchWorkspaces();
  }, [fetchWorkspaces]);

  return <>{children}</>;
}

// Re-export the Workspace type for consumers
export type { Workspace };
