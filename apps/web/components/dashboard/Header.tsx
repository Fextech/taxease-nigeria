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
  const [notifOpen, setNotifOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);

  // Support Modal State
  const [supportOpen, setSupportOpen] = useState(false);
  const [supportSubject, setSupportSubject] = useState("");
  const [supportCategory, setSupportCategory] = useState("Parsing Error");
  const [supportMessage, setSupportMessage] = useState("");
  const [isSubmittingSupport, setIsSubmittingSupport] = useState(false);

  // Toast State
  const [toastMsg, setToastMsg] = useState<{ text: string, type: "success" | "error" } | null>(null);

  const showToast = (text: string, type: "success" | "error" = "success") => {
    setToastMsg({ text, type });
    setTimeout(() => setToastMsg(null), 4000);
  };

  const profileRef = useRef<HTMLDivElement>(null);
  const workspaceRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);

  // Fetch notifications
  useEffect(() => {
    if (!session?.user?.id) return;
    const fetchNotifs = async () => {
      try {
        const res = await fetch("/api/notifications");
        if (res.ok) setNotifications(await res.json());
      } catch { /* silent */ }
    };
    fetchNotifs();
    // Poll every 30 seconds
    const interval = setInterval(fetchNotifs, 30000);
    return () => clearInterval(interval);
  }, [session?.user?.id]);

  const unreadCount = notifications.filter(n => !n.isRead).length;

  const handleMarkRead = async (id: string, link?: string) => {
    try {
      await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "mark_read", notificationId: id })
      });
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n));
      if (link) router.push(link);
    } catch { /* silent */ }
  };

  const handleMarkAllRead = async () => {
    try {
      await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "mark_all_read" })
      });
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
    } catch { /* silent */ }
  };

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setProfileOpen(false);
      }
      if (workspaceRef.current && !workspaceRef.current.contains(e.target as Node)) {
        setWorkspaceOpen(false);
      }
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setNotifOpen(false);
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
      showToast("Invalid year. Must be between 2020 and 2030.", "error");
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
        showToast(`Tax Year ${year} workspace created!`, "success");
        router.refresh(); // Force Next.js to drop its router cache
      } else {
        const err = await res.json();
        showToast(err.error || "Failed to create workspace", "error");
      }
    } finally {
      setIsCreating(false);
    }
  };

  const handleSupportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supportSubject.trim() || !supportMessage.trim()) {
      showToast("Please fill in all fields.", "error");
      return;
    }
    
    setIsSubmittingSupport(true);
    try {
      const res = await fetch("/api/support", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject: supportSubject,
          category: supportCategory,
          message: supportMessage
        })
      });

      if (res.ok) {
        showToast("Support request submitted successfully. Our team will get back to you soon!", "success");
        setSupportOpen(false);
        setSupportSubject("");
        setSupportCategory("Parsing Error");
        setSupportMessage("");
      } else {
        const err = await res.json();
        showToast(err.error || "Failed to submit support request.", "error");
      }
    } catch {
      showToast("A network error occurred.", "error");
    } finally {
      setIsSubmittingSupport(false);
    }
  };

  const user = session?.user;
  const initials = user?.name
    ? user.name.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase()
    : "U";

  return (
    <>
      {/* Toast Notification */}
      {toastMsg && (
        <div style={{
          position: "fixed", top: "24px", left: "50%", transform: "translateX(-50%)",
          zIndex: 9999, padding: "12px 20px", borderRadius: "8px",
          background: toastMsg.type === "success" ? "#10b981" : "#ef4444",
          color: "white", fontWeight: 500, fontSize: "14px",
          boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -4px rgba(0, 0, 0, 0.1)",
          display: "flex", alignItems: "center", gap: "8px",
          animation: "slideDown 0.3s ease-out forwards"
        }}>
          <span className="material-symbols-outlined" style={{ fontSize: 20 }}>
            {toastMsg.type === "success" ? "check_circle" : "error"}
          </span>
          {toastMsg.text}
        </div>
      )}

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
          {/* Support Button */}
          <button 
            className="dash-notif-btn" 
            onClick={() => setSupportOpen(true)}
            aria-label="Support"
            style={{ marginRight: "-8px" }}
          >
            <span className="material-symbols-outlined">support_agent</span>
          </button>

          {/* Notifications */}
          <div className="dash-profile-wrap" ref={notifRef}>
            <button 
              className="dash-notif-btn" 
              onClick={() => setNotifOpen(v => !v)}
              aria-expanded={notifOpen}
            >
              <span className="material-symbols-outlined">notifications</span>
              {unreadCount > 0 && <span className="dash-notif-dot" />}
            </button>

            {notifOpen && (
              <div className="dash-profile-dropdown" style={{ width: 320, padding: "8px 0" }}>
                <div className="dash-dropdown-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <p className="dash-dropdown-name">Notifications</p>
                  {unreadCount > 0 && (
                    <button onClick={handleMarkAllRead} className="text-xs text-slate-400 hover:text-white transition-colors">
                      Mark all read
                    </button>
                  )}
                </div>
                <div className="dash-dropdown-divider" style={{ marginBottom: 0 }} />
                
                <div style={{ maxHeight: 300, overflowY: "auto" }}>
                  {notifications.length === 0 ? (
                    <div style={{ padding: "24px 16px", textAlign: "center", color: "var(--te-text-muted)", fontSize: 13 }}>
                      You have no notifications.
                    </div>
                  ) : (
                    notifications.map(n => {
                      const icon = n.type === "SUCCESS" ? "check_circle" : 
                                   n.type === "ERROR" ? "error" : "info";
                      const iconColor = n.type === "SUCCESS" ? "#10b981" : 
                                        n.type === "ERROR" ? "#ef4444" : "#3b82f6";

                      return (
                        <button 
                          key={n.id}
                          className="dash-dropdown-item"
                          onClick={() => handleMarkRead(n.id, n.link)}
                          style={{
                            alignItems: "flex-start",
                            padding: "12px 16px",
                            height: "auto",
                            background: n.isRead ? "transparent" : "rgba(255,255,255,0.03)",
                            gap: 12
                          }}
                        >
                          <span className="material-symbols-outlined mt-0.5" style={{ fontSize: 18, color: iconColor }}>{icon}</span>
                          <div style={{ display: "flex", flexDirection: "column", gap: 4, alignItems: "flex-start", textAlign: "left" }}>
                            <span style={{ fontSize: 13, fontWeight: n.isRead ? 500 : 600, color: n.isRead ? "var(--te-text-secondary)" : "#fff" }}>
                              {n.title}
                            </span>
                            <span style={{ fontSize: 12, color: "var(--te-text-muted)", lineHeight: 1.4, whiteSpace: "normal" }}>
                              {n.message}
                            </span>
                            <span style={{ fontSize: 11, color: "var(--te-text-muted)", marginTop: 4 }}>
                              {new Date(n.createdAt).toLocaleDateString()}
                            </span>
                          </div>
                          {!n.isRead && (
                            <div style={{ width: 8, height: 8, borderRadius: 4, background: "var(--te-primary)", marginTop: 6, marginLeft: "auto", flexShrink: 0 }} />
                          )}
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </div>

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

      {/* Support Modal */}
      {supportOpen && (
        <div className="modal-overlay">
          <div className="modal-card" style={{ maxWidth: "500px" }}>
            <div className="modal-header">
              <span className="material-symbols-outlined" style={{ fontSize: 24, color: "var(--te-primary)" }}>support_agent</span>
              <h3 className="modal-title">Contact Support</h3>
            </div>
            <p className="modal-desc" style={{ marginBottom: "20px" }}>
              Need help? Fill out the form below and our support team will get back to you as soon as possible.
            </p>
            
            <form onSubmit={handleSupportSubmit} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <div>
                <label style={{ display: "block", fontSize: "13px", fontWeight: 500, color: "var(--te-text-secondary)", marginBottom: "6px" }}>
                  Subject
                </label>
                <input
                  type="text"
                  className="modal-input"
                  placeholder="Briefly describe your issue"
                  value={supportSubject}
                  onChange={(e) => setSupportSubject(e.target.value)}
                  disabled={isSubmittingSupport}
                  required
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "13px", fontWeight: 500, color: "var(--te-text-secondary)", marginBottom: "6px" }}>
                  Category
                </label>
                <select
                  className="modal-input"
                  value={supportCategory}
                  onChange={(e) => setSupportCategory(e.target.value)}
                  disabled={isSubmittingSupport}
                  style={{ cursor: "pointer", appearance: "auto" }}
                >
                  <option value="Parsing Error">Parsing Error</option>
                  <option value="Account">Account</option>
                  <option value="Billing">Billing</option>
                  <option value="Filing Question">Filing Question</option>
                  <option value="Feature Request">Feature Request</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div>
                <label style={{ display: "block", fontSize: "13px", fontWeight: 500, color: "var(--te-text-secondary)", marginBottom: "6px" }}>
                  Message
                </label>
                <textarea
                  className="modal-input"
                  placeholder="Provide details about your inquiry..."
                  value={supportMessage}
                  onChange={(e) => setSupportMessage(e.target.value)}
                  rows={4}
                  disabled={isSubmittingSupport}
                  style={{ resize: "vertical", minHeight: "100px" }}
                  required
                />
              </div>

              <div className="modal-actions" style={{ marginTop: "8px" }}>
                <button
                  type="button"
                  className="modal-btn-cancel"
                  onClick={() => setSupportOpen(false)}
                  disabled={isSubmittingSupport}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="modal-btn-confirm"
                  disabled={isSubmittingSupport}
                >
                  {isSubmittingSupport ? "Submitting..." : "Submit request"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </>
  );
}