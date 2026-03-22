"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

// ─── Types ──────────────────────────────────────────────────
export interface Workspace {
  id: string;
  taxYear: number;
  status: string;
  isUnlocked?: boolean;
  statementCredits?: number;
  allowedBanksCount?: number;
  additionalDeductions?: { label: string; amount: string }[] | null;
  annualRentAmount?: bigint | null;
  unlockedMonths?: number[] | null;
  unlockMethod?: string | null;
}

interface WorkspaceState {
  workspaces: Workspace[];
  activeWorkspaceId: string | null;
  loading: boolean;

  // Actions
  setActiveWorkspaceId: (id: string) => void;
  fetchWorkspaces: () => Promise<void>;
  refresh: () => Promise<void>;
}

// ─── Store ──────────────────────────────────────────────────
export const useWorkspaceStore = create<WorkspaceState>()(
  persist(
    (set, get) => ({
      workspaces: [],
      activeWorkspaceId: null,
      loading: true,

      setActiveWorkspaceId: (id: string) => {
        set({ activeWorkspaceId: id });
      },

      fetchWorkspaces: async () => {
        try {
          const res = await fetch("/api/workspace", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "list" }),
            cache: "no-store",
          });

          if (!res.ok) return;

          const data = await res.json();
          let ws: Workspace[] = Array.isArray(data) ? data : [];

          const { activeWorkspaceId } = get();
          const newState: Partial<WorkspaceState> = {
            workspaces: ws,
            loading: false,
          };

          // Auto-select first workspace if none selected or current one no longer exists
          if (ws.length > 0) {
            const activeExists = ws.some((w) => w.id === activeWorkspaceId);
            if (!activeWorkspaceId || !activeExists) {
              newState.activeWorkspaceId = ws[0].id;
            }
          }

          set(newState);
        } catch (err) {
          console.error("[WorkspaceStore] Fetch error:", err);
          set({ loading: false });
        }
      },

      refresh: async () => {
        await get().fetchWorkspaces();
      },
    }),
    {
      name: "bl_active_ws", // localStorage key — Banklens prefix
      partialize: (state: WorkspaceState) => ({
        activeWorkspaceId: state.activeWorkspaceId,
      }),
    }
  )
);
