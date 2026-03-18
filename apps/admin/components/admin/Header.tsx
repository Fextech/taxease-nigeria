"use client";

import { usePathname, useRouter } from "next/navigation";
import { useAdminStore } from "@/stores/admin-store";
import { getInitials } from "@/lib/utils";
import { useState, useRef, useEffect } from "react";

const PAGE_TITLES: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/users": "User Management",
  "/broadcast": "Broadcasts",
  "/billing": "Billing & Revenue Management",
  "/support": "Support Centre",
  "/system": "System Health",
  "/audit": "Audit Log",
  "/analytics": "Analytics & Reports",
  "/settings": "System Settings",
};

export default function AdminHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const { admin, logout } = useAdminStore();
  const [showProfile, setShowProfile] = useState(false);
  const [search, setSearch] = useState("");
  const profileRef = useRef<HTMLDivElement>(null);

  // Determine page title from pathname
  const pageTitle =
    PAGE_TITLES[pathname] ||
    Object.entries(PAGE_TITLES).find(([path]) =>
      pathname.startsWith(path)
    )?.[1] ||
    "Admin Panel";

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setShowProfile(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleLogout = () => {
    logout();
    router.push("/login");
  };

  return (
    <header className="admin-header">
      <div className="admin-header-left">
        <h1 className="admin-header-title">{pageTitle}</h1>
      </div>

      {/* Search */}
      <div className="admin-header-search">
        <span
          className="material-symbols-outlined"
          style={{ fontSize: 18, color: "var(--admin-text-muted)" }}
        >
          search
        </span>
        <input
          type="text"
          placeholder="Search transactions, users or reports..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="admin-header-right">
        {/* Notifications */}
        <button className="admin-header-icon-btn" title="Notifications">
          <span className="material-symbols-outlined" style={{ fontSize: 20 }}>
            notifications
          </span>
        </button>

        {/* Settings shortcut */}
        <button
          className="admin-header-icon-btn"
          title="Settings"
          onClick={() => router.push("/settings")}
        >
          <span className="material-symbols-outlined" style={{ fontSize: 20 }}>
            settings
          </span>
        </button>

        {/* Profile */}
        <div ref={profileRef} style={{ position: "relative" }}>
          <button
            className="admin-sidebar-profile"
            onClick={() => setShowProfile(!showProfile)}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "4px 8px",
              borderRadius: "var(--admin-radius)",
            }}
          >
            <div className="admin-sidebar-avatar" style={{ width: 30, height: 30, fontSize: 11 }}>
              {getInitials(admin?.fullName)}
            </div>
            <div style={{ textAlign: "left" }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: "var(--admin-text)", display: "block", lineHeight: 1.2 }}>
                {admin?.fullName || "Admin"}
              </span>
              <span style={{ fontSize: 11, color: "var(--admin-cyan)" }}>
                {admin?.role?.replace(/_/g, " ") || "Super Admin"}
              </span>
            </div>
          </button>

          {showProfile && (
            <div
              style={{
                position: "absolute",
                top: "calc(100% + 8px)",
                right: 0,
                minWidth: 200,
                background: "var(--admin-surface)",
                border: "1px solid var(--admin-border)",
                borderRadius: "var(--admin-radius-lg)",
                boxShadow: "0 12px 32px rgba(0,0,0,0.3)",
                padding: 8,
                zIndex: 50,
                animation: "dropIn 0.15s ease",
              }}
            >
              <div style={{ padding: "8px 12px 12px" }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: "var(--admin-text)" }}>
                  {admin?.fullName}
                </div>
                <div style={{ fontSize: 12, color: "var(--admin-text-muted)", marginTop: 2 }}>
                  {admin?.email}
                </div>
              </div>
              <div style={{ height: 1, background: "var(--admin-border)", margin: "4px 0" }} />
              <button
                onClick={() => { setShowProfile(false); router.push("/settings"); }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "10px 12px",
                  borderRadius: "var(--admin-radius)",
                  color: "var(--admin-text-secondary)",
                  fontSize: 13,
                  fontWeight: 500,
                  cursor: "pointer",
                  border: "none",
                  background: "none",
                  width: "100%",
                  fontFamily: "var(--font-sans)",
                  textAlign: "left",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "var(--admin-surface-hover)";
                  e.currentTarget.style.color = "var(--admin-text)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "none";
                  e.currentTarget.style.color = "var(--admin-text-secondary)";
                }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 18 }}>settings</span>
                Settings
              </button>
              <button
                onClick={handleLogout}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "10px 12px",
                  borderRadius: "var(--admin-radius)",
                  color: "var(--admin-text-secondary)",
                  fontSize: 13,
                  fontWeight: 500,
                  cursor: "pointer",
                  border: "none",
                  background: "none",
                  width: "100%",
                  fontFamily: "var(--font-sans)",
                  textAlign: "left",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "var(--admin-surface-hover)";
                  e.currentTarget.style.color = "#ef4444";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "none";
                  e.currentTarget.style.color = "var(--admin-text-secondary)";
                }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 18 }}>logout</span>
                Sign Out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
