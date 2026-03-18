"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAdminStore } from "@/stores/admin-store";
import { getInitials } from "@/lib/utils";

const NAV_ITEMS = [
  {
    section: "Main Menu",
    links: [
      { href: "/dashboard", icon: "dashboard", label: "Dashboard" },
      { href: "/users", icon: "people", label: "Users" },
      { href: "/broadcast", icon: "campaign", label: "Broadcast" },
      { href: "/billing", icon: "payments", label: "Billing" },
      { href: "/support", icon: "support_agent", label: "Support" },
    ],
  },
  {
    section: "System",
    links: [
      { href: "/system", icon: "monitor_heart", label: "System" },
      { href: "/audit", icon: "shield", label: "Audit" },
      { href: "/analytics", icon: "analytics", label: "Analytics" },
      { href: "/settings", icon: "settings", label: "Settings" },
    ],
  },
];

export default function AdminSidebar() {
  const pathname = usePathname();
  const { admin, logout } = useAdminStore();

  return (
    <aside className="admin-sidebar">
      {/* Brand */}
      <div className="admin-sidebar-brand">
        <div className="admin-sidebar-logo">
          <span className="material-symbols-outlined" style={{ fontSize: 20 }}>
            account_balance
          </span>
        </div>
        <div className="admin-sidebar-brand-text">
          <span className="admin-sidebar-brand-name">Banklens Nigeria</span>
          <span className="admin-sidebar-brand-label">Admin</span>
        </div>
      </div>

      {/* Navigation */}
      {NAV_ITEMS.map((section) => (
        <nav key={section.section} className="admin-sidebar-section">
          <div className="admin-sidebar-section-label">{section.section}</div>
          {section.links.map((link) => {
            const isActive =
              pathname === link.href ||
              (link.href !== "/dashboard" && pathname.startsWith(link.href));

            return (
              <Link
                key={link.href}
                href={link.href}
                className={`admin-sidebar-link ${isActive ? "admin-sidebar-link--active" : ""}`}
              >
                <span className="material-symbols-outlined admin-sidebar-link-icon">
                  {link.icon}
                </span>
                <span>{link.label}</span>
              </Link>
            );
          })}
        </nav>
      ))}

      {/* Footer — Admin Profile */}
      <div className="admin-sidebar-footer">
        <div className="admin-sidebar-profile">
          <div className="admin-sidebar-avatar">
            {getInitials(admin?.fullName)}
          </div>
          <div className="admin-sidebar-profile-info">
            <span className="admin-sidebar-profile-name">
              {admin?.fullName || "Admin"}
            </span>
            <span className="admin-sidebar-profile-role">
              {admin?.role?.replace(/_/g, " ") || "Super Admin"}
            </span>
          </div>
        </div>
      </div>
    </aside>
  );
}
