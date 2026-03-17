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

    </WorkspaceProvider>
  );
}
