import { create } from "zustand";
import { persist } from "zustand/middleware";

interface AdminState {
  /** JWT token for admin authentication */
  token: string | null;
  /** Current admin user info (decoded from JWT) */
  admin: {
    id: string;
    email: string;
    fullName: string;
    role: string;
  } | null;
  /** Sidebar collapsed state */
  sidebarCollapsed: boolean;

  setToken: (token: string | null) => void;
  setAdmin: (admin: AdminState["admin"]) => void;
  toggleSidebar: () => void;
  logout: () => void;
}

export const useAdminStore = create<AdminState>()(
  persist(
    (set) => ({
      token: null,
      admin: null,
      sidebarCollapsed: false,

      setToken: (token) => {
        set({ token });
        if (token) {
          localStorage.setItem("admin_token", token);
        } else {
          localStorage.removeItem("admin_token");
        }
      },

      setAdmin: (admin) => set({ admin }),

      toggleSidebar: () =>
        set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),

      logout: () => {
        localStorage.removeItem("admin_token");
        set({ token: null, admin: null });
      },
    }),
    {
      name: "banklens-admin",
      partialize: (state) => ({
        token: state.token,
        admin: state.admin,
        sidebarCollapsed: state.sidebarCollapsed,
      }),
    }
  )
);
