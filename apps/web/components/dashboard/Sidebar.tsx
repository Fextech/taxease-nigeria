"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useWorkspace } from "./WorkspaceContext";

const navItems = [
  { label: "Overview", href: "/overview", icon: "dashboard" },
  { label: "Statements", href: "/statements", icon: "description" },
  { label: "Annotations", href: "/annotations", icon: "draw" },
  { label: "Reports", href: "/reports", icon: "bar_chart" },
];

const systemItems = [
  { label: "Settings", href: "/settings", icon: "settings" },
];

export default function Sidebar({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) {
  const pathname = usePathname();
  const { activeWorkspace } = useWorkspace();
  const isUnlocked = activeWorkspace?.isUnlocked ?? false;

  const isActive = (href: string) =>
    href === "/overview" ? pathname === "/overview" : pathname.startsWith(href);

  const renderLink = (item: { label: string; href: string; icon: string }) => {
    const active = isActive(item.href);
    return (
      <Link
        key={item.href}
        href={item.href}
        className={`sidebar-link ${active ? "sidebar-link--active" : ""}`}
        title={collapsed ? item.label : undefined}
      >
        <span className="material-symbols-outlined sidebar-link-icon">{item.icon}</span>
        {!collapsed && <span className="sidebar-link-label">{item.label}</span>}
      </Link>
    );
  };

  return (
    <>
      <aside className={`sidebar ${collapsed ? "sidebar--collapsed" : ""}`}>
        {/* Brand */}
        <div className="sidebar-brand">
          <div className="sidebar-logo">
            <span className="material-symbols-outlined" style={{ color: "#fff", fontSize: 20 }}>account_balance_wallet</span>
          </div>
          {!collapsed && (
            <div>
              <span className="sidebar-brand-text">Banklens Nigeria</span>
              <span className="sidebar-brand-sub">Tax Management Portal</span>
            </div>
          )}
          <button className="sidebar-toggle" onClick={onToggle} aria-label="Toggle sidebar">
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
              {collapsed ? "menu" : "chevron_left"}
            </span>
          </button>
        </div>

        {/* Main Navigation */}
        <nav className="sidebar-nav">
          {navItems.map(renderLink)}

          {/* System Section */}
          {!collapsed && (
            <div className="sidebar-section-label">System</div>
          )}
          {systemItems.map(renderLink)}
        </nav>

        {/* Plan Footer */}
        {!collapsed && (
          <div className="sidebar-footer">
            <div className="sidebar-plan-card">
              <p className="sidebar-plan-label">Current Plan</p>
              <p className="sidebar-plan-tier" style={{ textTransform: "capitalize" }}>
                {isUnlocked ? "Standard (Unlocked)" : "Free Tier"}
              </p>
              {!isUnlocked && (
                <button className="sidebar-plan-btn" onClick={() => window.location.href = "/settings?tab=billing"}>
                  Unlock Full Year
                </button>
              )}
            </div>
          </div>
        )}
      </aside>

    </>
  );
}