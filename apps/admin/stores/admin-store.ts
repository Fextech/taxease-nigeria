import { create } from "zustand";
import { persist } from "zustand/middleware";

interface AdminState {
  /** Current admin user info (decoded from JWT) */
  admin: {
    id: string;
    email: string;
    fullName: string;
    role: string;
  } | null;
  /** Sidebar collapsed state */
  sidebarCollapsed: boolean;

  setAdmin: (admin: AdminState["admin"]) => void;
  toggleSidebar: () => void;
  logout: () => void;
}

export const useAdminStore = create<AdminState>()(
  persist(
    (set) => ({
      admin: null,
      sidebarCollapsed: false,

      setAdmin: (admin) => set({ admin }),

      toggleSidebar: () =>
        set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),

      logout: () => {
        set({ admin: null });
      },
    }),
    {
      name: "banklens-admin",
      partialize: (state) => ({
        admin: state.admin,
        sidebarCollapsed: state.sidebarCollapsed,
      }),
    }
  )
);
