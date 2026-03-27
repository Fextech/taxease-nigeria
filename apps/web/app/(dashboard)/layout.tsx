"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import Sidebar from "@/components/dashboard/Sidebar";
import Header from "@/components/dashboard/Header";
import { WorkspaceProvider } from "@/components/dashboard/WorkspaceContext";
import HowToGuideModal from "@/components/HowToGuideModal";
import { useInactivityTimeout } from "@/hooks/useInactivityTimeout";
import MobileNav from "@/components/dashboard/MobileNav";

function InactivityWarning({ onDismiss }: { onDismiss: () => void }) {
  return (
    <div
      role="alert"
      style={{
        position: "fixed",
        bottom: "var(--inactivity-warning-bottom, 24px)",
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 9999,
        background: "#1e293b",
        color: "#f1f5f9",
        border: "1px solid rgba(251,191,36,0.4)",
        borderRadius: 12,
        padding: "14px 20px",
        boxShadow: "0 8px 32px rgba(0,0,0,0.3)",
        display: "flex",
        alignItems: "center",
        gap: 12,
        fontSize: 14,
        fontWeight: 500,
        maxWidth: 460,
        width: "calc(100vw - 48px)",
        animation: "fadeInUp 0.3s ease",
      }}
    >
      <span
        className="material-symbols-outlined"
        style={{ fontSize: 20, color: "#fbbf24", flexShrink: 0 }}
      >
        timer
      </span>
      <span style={{ flex: 1 }}>
        You&apos;ll be signed out in <strong>2 minutes</strong> due to inactivity.
        Move your mouse or press a key to stay signed in.
      </span>
      <button
        onClick={onDismiss}
        style={{
          background: "rgba(251,191,36,0.15)",
          border: "1px solid rgba(251,191,36,0.3)",
          color: "#fbbf24",
          borderRadius: 8,
          padding: "4px 12px",
          cursor: "pointer",
          fontSize: 13,
          fontWeight: 600,
          whiteSpace: "nowrap",
          flexShrink: 0,
        }}
      >
        Stay signed in
      </button>
    </div>
  );
}

function DashboardWithTimeout({ children, pageTitle, collapsed, setCollapsed }: {
  children: React.ReactNode;
  pageTitle: string;
  collapsed: boolean;
  setCollapsed: (fn: (v: boolean) => boolean) => void;
}) {
  const { isWarning, resetTimer } = useInactivityTimeout();

  return (
    <>
      <div className="dash-layout">
        <Sidebar collapsed={collapsed} onToggle={() => setCollapsed((v) => !v)} />
        <div className={`dash-main ${collapsed ? "dash-main--collapsed" : ""}`}>
          <Header title={pageTitle} />
          <main className="dash-content">{children}</main>
        </div>
      </div>
      <MobileNav />
      {isWarning && <InactivityWarning onDismiss={resetTimer} />}
    </>
  );
}

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
      <HowToGuideModal />
      <DashboardWithTimeout
        pageTitle={pageTitle}
        collapsed={collapsed}
        setCollapsed={setCollapsed}
      >
        {children}
      </DashboardWithTimeout>
    </WorkspaceProvider>
  );
}
