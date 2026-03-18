"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import Sidebar from "@/components/dashboard/Sidebar";
import Header from "@/components/dashboard/Header";
import { WorkspaceProvider } from "@/components/dashboard/WorkspaceContext";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const pathname = usePathname();

  let pageTitle = "Overview";
  if (pathname?.includes("/statements")) pageTitle = "Statements";
  else if (pathname?.includes("/annotations")) pageTitle = "Annotations";
  else if (pathname?.includes("/reports")) pageTitle = "Reports";
  else if (pathname?.includes("/settings")) pageTitle = "Settings";

  return (
    <WorkspaceProvider>
      <div className="dash-layout">
        <Sidebar collapsed={collapsed} onToggle={() => setCollapsed((v) => !v)} />
        <div className={`dash-main ${collapsed ? "dash-main--collapsed" : ""}`}>
          <Header title={pageTitle} />
          <main className="dash-content">{children}</main>
        </div>
      </div>

    </WorkspaceProvider>
  );
}
