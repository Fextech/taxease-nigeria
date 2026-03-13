"use client";

import { useState } from "react";
import Sidebar from "@/components/dashboard/Sidebar";
import Header from "@/components/dashboard/Header";
import { WorkspaceProvider } from "@/components/dashboard/WorkspaceContext";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <WorkspaceProvider>
      <div className="dash-layout">
        <Sidebar collapsed={collapsed} onToggle={() => setCollapsed((v) => !v)} />
        <div className={`dash-main ${collapsed ? "dash-main--collapsed" : ""}`}>
          <Header />
          <main className="dash-content">{children}</main>
        </div>
      </div>

      <style jsx>{`
        .dash-layout {
          display: flex;
          min-height: 100vh;
          background: var(--te-bg);
        }

        .dash-main {
          flex: 1;
          margin-left: var(--te-sidebar-width);
          transition: margin-left 0.25s cubic-bezier(0.4, 0, 0.2, 1);
          display: flex;
          flex-direction: column;
          min-width: 0;
        }

        .dash-main--collapsed {
          margin-left: 68px;
        }

        .dash-content {
          flex: 1;
          padding: 32px;
          max-width: 1280px;
        }

        @media (max-width: 768px) {
          .dash-main {
            margin-left: 0;
          }
          .dash-content {
            padding: 20px 16px;
          }
        }
      `}</style>
    </WorkspaceProvider>
  );
}
