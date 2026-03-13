"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

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
              <span className="sidebar-brand-text">TaxEase Nigeria</span>
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
              <p className="sidebar-plan-tier">Free Tier</p>
              <button className="sidebar-plan-btn">Upgrade Pro</button>
            </div>
          </div>
        )}
      </aside>

      <style jsx>{`
        .sidebar {
          width: var(--te-sidebar-width);
          height: 100vh;
          position: fixed;
          top: 0;
          left: 0;
          z-index: 40;
          display: flex;
          flex-direction: column;
          background: var(--te-surface);
          border-right: 1px solid rgba(35, 73, 77, 0.1);
          transition: width 0.25s cubic-bezier(0.4, 0, 0.2, 1);
          overflow: hidden;
        }
        .sidebar--collapsed { width: 68px; }

        /* Brand */
        .sidebar-brand {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 24px 24px 20px;
          position: relative;
        }
        .sidebar-logo {
          width: 40px;
          height: 40px;
          min-width: 40px;
          border-radius: 8px;
          background: var(--te-primary);
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .sidebar-brand-text {
          display: block;
          font-size: 14px;
          font-weight: 700;
          color: var(--te-primary);
          line-height: 1.2;
        }
        .sidebar-brand-sub {
          display: block;
          font-size: 11px;
          color: var(--te-text-muted);
        }
        .sidebar-toggle {
          position: absolute;
          right: 12px;
          top: 50%;
          transform: translateY(-50%);
          width: 28px;
          height: 28px;
          border-radius: 8px;
          border: 1px solid var(--te-border);
          background: var(--te-surface);
          color: var(--te-text-muted);
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all 0.2s;
        }
        .sidebar-toggle:hover {
          background: var(--te-surface-hover);
          color: var(--te-text);
        }

        /* Nav */
        .sidebar-nav {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 2px;
          padding: 0 16px;
        }
        .sidebar-section-label {
          font-size: 10px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          color: var(--te-text-muted);
          padding: 16px 12px 8px;
        }

        /* Links */
        .sidebar-link {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 10px 12px;
          border-radius: 8px;
          color: var(--te-text-secondary);
          text-decoration: none;
          font-size: 14px;
          font-weight: 500;
          transition: all 0.15s ease;
          white-space: nowrap;
        }
        .sidebar-link:hover {
          background: rgba(35, 73, 77, 0.05);
          color: var(--te-text);
        }
        .sidebar-link--active {
          background: var(--te-primary);
          color: #ffffff;
        }
        .sidebar-link--active:hover {
          background: var(--te-primary);
          color: #ffffff;
        }
        .sidebar-link-icon {
          font-size: 20px;
        }
        .sidebar-link-label {
          overflow: hidden;
          text-overflow: ellipsis;
        }

        /* Plan Footer */
        .sidebar-footer {
          padding: 24px;
          border-top: 1px solid rgba(35, 73, 77, 0.1);
          margin-top: auto;
        }
        .sidebar-plan-card {
          background: rgba(35, 73, 77, 0.05);
          border-radius: 12px;
          padding: 16px;
        }
        .sidebar-plan-label {
          font-size: 12px;
          font-weight: 700;
          color: var(--te-primary);
          text-transform: uppercase;
          letter-spacing: 0.05em;
          margin: 0 0 4px 0;
        }
        .sidebar-plan-tier {
          font-size: 14px;
          font-weight: 500;
          color: var(--te-text);
          margin: 0 0 12px 0;
        }
        .sidebar-plan-btn {
          width: 100%;
          padding: 8px 0;
          background: var(--te-primary);
          color: #ffffff;
          font-size: 12px;
          font-weight: 700;
          border-radius: 8px;
          border: none;
          cursor: pointer;
          transition: background 0.2s;
        }
        .sidebar-plan-btn:hover {
          background: var(--te-primary-hover, #1a383b);
        }

        @media (max-width: 768px) {
          .sidebar { transform: translateX(-100%); }
          .sidebar:not(.sidebar--collapsed) {
            transform: translateX(0);
            box-shadow: 8px 0 24px rgba(0, 0, 0, 0.1);
          }
        }
      `}</style>
    </>
  );
}
