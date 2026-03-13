"use client";

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import { useSession } from "next-auth/react";

interface Workspace {
  id: string;
  taxYear: number;
  status: string;
}

interface WorkspaceContextValue {
  workspaces: Workspace[];
  activeWorkspaceId: string | null;
  activeWorkspace: Workspace | null;
  setActiveWorkspaceId: (id: string) => void;
  loading: boolean;
  refresh: () => Promise<void>;
}

const WorkspaceContext = createContext<WorkspaceContextValue>({
  workspaces: [],
  activeWorkspaceId: null,
  activeWorkspace: null,
  setActiveWorkspaceId: () => {},
  loading: true,
  refresh: async () => {},
});

export function useWorkspace() {
  return useContext(WorkspaceContext);
}

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  useSession();

  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [activeWorkspaceId, setActiveWorkspaceId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchWorkspaces = useCallback(async () => {
    try {
      console.log('[WorkspaceContext] Fetching workspaces...');
      const res = await fetch("/api/workspace", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "list" }),
        cache: "no-store",
      });
      console.log('[WorkspaceContext] Response status:', res.status);
      
      if (res.ok) {
        const data = await res.json();
        console.log('[WorkspaceContext] Raw data:', JSON.stringify(data));
        let ws: Workspace[] = Array.isArray(data) ? data : [];

        // Auto-create a workspace for current year if none exist
        if (ws.length === 0) {
          console.log('[WorkspaceContext] No workspaces found, creating one for current year...');
          const createRes = await fetch("/api/workspace", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "create", taxYear: new Date().getFullYear() }),
          });
          console.log('[WorkspaceContext] Create response:', createRes.status);
          if (createRes.ok) {
            const newWs = await createRes.json();
            ws = [newWs];
          } else {
            const errData = await createRes.json();
            console.log('[WorkspaceContext] Create error:', errData);
          }
        }

        setWorkspaces(ws);

        // Auto-select first workspace if none selected
        if (ws.length > 0 && !activeWorkspaceId) {
          const saved = typeof window !== "undefined" ? localStorage.getItem("te_active_ws") : null;
          const match = saved ? ws.find((w) => w.id === saved) : null;
          setActiveWorkspaceId(match ? match.id : ws[0].id);
        }
      } else {
        const errBody = await res.text();
        console.log('[WorkspaceContext] Error response:', errBody);
      }
    } catch (err) {
      console.error('[WorkspaceContext] Fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [activeWorkspaceId]);

  useEffect(() => {
    fetchWorkspaces();
  }, [fetchWorkspaces]);

  const handleSetActive = useCallback((id: string) => {
    setActiveWorkspaceId(id);
    if (typeof window !== "undefined") {
      localStorage.setItem("te_active_ws", id);
    }
  }, []);

  const activeWorkspace = workspaces.find((w) => w.id === activeWorkspaceId) || null;

  return (
    <WorkspaceContext.Provider
      value={{
        workspaces,
        activeWorkspaceId,
        activeWorkspace,
        setActiveWorkspaceId: handleSetActive,
        loading,
        refresh: fetchWorkspaces,
      }}
    >
      {children}
    </WorkspaceContext.Provider>
  );
}
