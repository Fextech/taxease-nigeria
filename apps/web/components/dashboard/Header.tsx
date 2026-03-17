"use client";

import { useSession, signOut } from "next-auth/react";
import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useWorkspace } from "./WorkspaceContext";

export default function Header({ title = "Dashboard" }: { title?: string }) {
  const { data: session } = useSession();
  const { workspaces, activeWorkspace, setActiveWorkspaceId, refresh, loading } = useWorkspace();

  const [profileOpen, setProfileOpen] = useState(false);
  const [workspaceOpen, setWorkspaceOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  const profileRef = useRef<HTMLDivElement>(null);
  const workspaceRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setProfileOpen(false);
      }
      if (workspaceRef.current && !workspaceRef.current.contains(e.target as Node)) {
        setWorkspaceOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const router = useRouter();

  const handleCreateWorkspace = async () => {
    const yearStr = prompt("Enter Tax Year (e.g. 2024):", new Date().getFullYear().toString());
    if (!yearStr) return;
    const year = parseInt(yearStr, 10);
    if (isNaN(year) || year < 2020 || year > 2030) {
      alert("Invalid year. Must be between 2020 and 2030.");
      return;
    }

    setIsCreating(true);
    try {
      const res = await fetch("/api/workspace", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "create", taxYear: year }),
        cache: "no-store"
      });
      if (res.ok) {
        const data = await res.json();
        await refresh();
        setActiveWorkspaceId(data.id);
        setWorkspaceOpen(false);
        router.refresh(); // Force Next.js to drop its router cache
      } else {
        const err = await res.json();
        alert(err.error || "Failed to create workspace");
      }
    } finally {
      setIsCreating(false);
    }
  };

  const user = session?.user;
  const initials = user?.name
    ? user.name.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase()
    : "U";

  return (
    <>
      <header className="dash-header">
        <div className="dash-header-left">
          <h2 className="dash-header-title">{title}</h2>
          <div className="dash-header-divider" />

          <div className="dash-workspace-wrap" ref={workspaceRef}>
            <button
              className="dash-year-selector"
              onClick={() => setWorkspaceOpen(v => !v)}
              disabled={loading}
            >
              <span className="dash-year-text">
                {loading ? "Loading..." : activeWorkspace ? `Tax Year: ${activeWorkspace.taxYear}` : "Select Year"}
              </span>
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>expand_more</span>
            </button>

            {workspaceOpen && (
              <div className="dash-workspace-dropdown">
                <div className="dash-dropdown-header">
                  <p className="dash-dropdown-name">Switch Tax Year</p>
                </div>
                <div className="dash-dropdown-divider" />

                {workspaces.map(ws => (
                  <button
                    key={ws.id}
                    className={`ws-dropdown-item ${activeWorkspace?.id === ws.id ? "ws-dropdown-item--active" : ""}`}
                    onClick={() => {
                      setActiveWorkspaceId(ws.id);
                      setWorkspaceOpen(false);
                    }}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
                      {ws.status === 'LOCKED' ? 'lock' : 'calendar_today'}
                    </span>
                    {ws.taxYear}
                  </button>
                ))}

                <div className="dash-dropdown-divider" />
                <button
                  className="ws-dropdown-item ws-dropdown-item--action"
                  onClick={handleCreateWorkspace}
                  disabled={isCreating}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 16 }}>add</span>
                  {isCreating ? "Adding..." : "Add New Year"}
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="dash-header-right">
          {/* Notifications */}
          <button className="dash-notif-btn">
            <span className="material-symbols-outlined">notifications</span>
            <span className="dash-notif-dot" />
          </button>

          <div className="dash-header-sep" />

          {/* Profile */}
          <div className="dash-profile-wrap" ref={profileRef}>
            <button
              className="dash-profile-btn"
              onClick={() => setProfileOpen((v) => !v)}
              aria-expanded={profileOpen}
              aria-label="User menu"
            >
              <div className="dash-profile-info">
                <span className="dash-profile-name">{user?.name || "User"}</span>
                <span className="dash-profile-tin">TIN: {session?.user?.email ? "Auto" : "—"}</span>
              </div>
              {user?.image ? (
                <img src={user.image} alt="" className="dash-avatar-img" />
              ) : (
                <span className="dash-avatar-initials">{initials}</span>
              )}
            </button>

            {profileOpen && (
              <div className="dash-profile-dropdown">
                <div className="dash-dropdown-header">
                  <p className="dash-dropdown-name">{user?.name || "User"}</p>
                  <p className="dash-dropdown-email">{user?.email || ""}</p>
                </div>
                <div className="dash-dropdown-divider" />
                <a href="/settings" className="dash-dropdown-item">
                  <span className="material-symbols-outlined" style={{ fontSize: 16 }}>person</span>
                  Account Settings
                </a>
                <button className="dash-dropdown-item dash-dropdown-signout" onClick={() => signOut({ callbackUrl: "/sign-in" })}>
                  <span className="material-symbols-outlined" style={{ fontSize: 16 }}>logout</span>
                  Sign out
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

    </>
  );
}