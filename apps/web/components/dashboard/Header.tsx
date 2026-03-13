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

      <style jsx>{`
        .dash-header {
          height: var(--te-header-height);
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 32px;
          background: var(--te-surface);
          border-bottom: 1px solid rgba(35, 73, 77, 0.1);
          position: sticky;
          top: 0;
          z-index: 30;
        }

        .dash-header-left {
          display: flex;
          align-items: center;
          gap: 16px;
        }

        .dash-header-title {
          font-size: 18px;
          font-weight: 700;
          color: var(--te-text);
          letter-spacing: -0.02em;
        }

        .dash-header-divider {
          width: 1px;
          height: 16px;
          background: var(--te-border);
        }

        .dash-year-selector {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 6px 12px;
          border-radius: 8px;
          border: 1px solid rgba(35, 73, 77, 0.1);
          background: var(--te-bg);
          cursor: pointer;
          transition: all 0.15s;
          font-family: var(--font-sans);
        }
        .dash-year-selector:hover {
          border-color: var(--te-primary-light);
        }
        .dash-year-text {
          font-size: 14px;
          font-weight: 600;
          color: var(--te-primary);
        }

        .dash-workspace-wrap { position: relative; }
        .dash-workspace-dropdown {
          position: absolute;
          top: calc(100% + 8px);
          left: 0;
          min-width: 200px;
          background: var(--te-surface);
          border: 1px solid var(--te-border);
          border-radius: var(--te-radius-lg);
          box-shadow: 0 12px 32px rgba(0, 0, 0, 0.1), 0 2px 6px rgba(0, 0, 0, 0.06);
          padding: 8px;
          animation: dropIn 0.15s ease;
        }

        .ws-dropdown-item {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 10px 12px;
          border-radius: var(--te-radius);
          color: var(--te-text-secondary);
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.12s;
          border: none;
          background: none;
          width: 100%;
          font-family: var(--font-sans);
          text-align: left;
        }
        .ws-dropdown-item:hover { background: var(--te-surface-hover); color: var(--te-text); }
        .ws-dropdown-item--active { background: rgba(35, 73, 77, 0.06); color: var(--te-primary); }
        .ws-dropdown-item--action { color: var(--te-primary); margin-top: 4px; }
        .ws-dropdown-item--action:hover { background: rgba(35, 73, 77, 0.08); }

        .dash-header-right {
          display: flex;
          align-items: center;
          gap: 16px;
        }

        .dash-notif-btn {
          position: relative;
          background: none;
          border: none;
          color: var(--te-text-muted);
          cursor: pointer;
          transition: color 0.15s;
          padding: 4px;
        }
        .dash-notif-btn:hover { color: var(--te-primary); }
        .dash-notif-dot {
          position: absolute;
          top: 4px;
          right: 4px;
          width: 8px;
          height: 8px;
          background: var(--te-error);
          border-radius: 50%;
          border: 2px solid var(--te-surface);
        }

        .dash-header-sep {
          width: 1px;
          height: 24px;
          background: rgba(35, 73, 77, 0.1);
        }

        /* Profile */
        .dash-profile-wrap { position: relative; }
        .dash-profile-btn {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 4px;
          border-radius: 8px;
          border: none;
          background: none;
          cursor: pointer;
          transition: all 0.15s;
          font-family: var(--font-sans);
        }
        .dash-profile-btn:hover { background: var(--te-surface-hover); }
        .dash-profile-info {
          text-align: right;
          display: none;
        }
        @media (min-width: 640px) {
          .dash-profile-info { display: block; }
        }
        .dash-profile-name {
          display: block;
          font-size: 14px;
          font-weight: 700;
          color: var(--te-text);
          line-height: 1.1;
        }
        .dash-profile-tin {
          display: block;
          font-size: 11px;
          color: var(--te-text-muted);
        }

        .dash-avatar-img {
          width: 40px;
          height: 40px;
          border-radius: 50%;
          object-fit: cover;
        }
        .dash-avatar-initials {
          width: 40px;
          height: 40px;
          border-radius: 50%;
          background: var(--te-mint);
          color: #fff;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 14px;
          font-weight: 700;
        }

        /* Dropdown */
        .dash-profile-dropdown {
          position: absolute;
          top: calc(100% + 8px);
          right: 0;
          min-width: 220px;
          background: var(--te-surface);
          border: 1px solid var(--te-border);
          border-radius: var(--te-radius-lg);
          box-shadow: 0 12px 32px rgba(0, 0, 0, 0.1), 0 2px 6px rgba(0, 0, 0, 0.06);
          padding: 8px;
          animation: dropIn 0.15s ease;
        }
        @keyframes dropIn {
          from { opacity: 0; transform: translateY(-6px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .dash-dropdown-header { padding: 8px 12px 12px; }
        .dash-dropdown-name { font-size: 14px; font-weight: 600; color: var(--te-text); }
        .dash-dropdown-email { font-size: 12px; color: var(--te-text-muted); margin-top: 2px; }
        .dash-dropdown-divider { height: 1px; background: var(--te-border-light); margin: 4px 0; }
        .dash-dropdown-item {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 10px 12px;
          border-radius: var(--te-radius);
          color: var(--te-text-secondary);
          font-size: 13px;
          font-weight: 500;
          text-decoration: none;
          cursor: pointer;
          transition: all 0.12s;
          border: none;
          background: none;
          width: 100%;
          font-family: var(--font-sans);
        }
        .dash-dropdown-item:hover { background: var(--te-surface-hover); color: var(--te-text); }
        .dash-dropdown-signout:hover { color: var(--te-error); }

        @media (max-width: 640px) {
          .dash-header { padding: 0 16px; }
        }
      `}</style>
    </>
  );
}
