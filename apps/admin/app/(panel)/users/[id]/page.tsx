"use client";

import { use, useState } from "react";
import { trpc } from "@/lib/trpc";
import { useRouter } from "next/navigation";

export default function UserDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();

  const [activeTab, setActiveTab] = useState("User Profile");

  const { data: user, isLoading, refetch } = trpc.admin.users.getUserDetails.useQuery({ id });
  
  const { mutateAsync: suspendUser, isPending: isSuspending } = trpc.admin.users.suspendUser.useMutation();
  const { mutateAsync: unsuspendUser, isPending: isUnsuspending } = trpc.admin.users.unsuspendUser.useMutation();
  const { mutateAsync: deleteUser, isPending: isDeleting } = trpc.admin.users.deleteUser.useMutation();
  
  // Actually, we need to show the unmasked email if requested
  const { mutateAsync: revealEmail } = trpc.admin.users.revealEmail.useMutation();
  const [revealedEmail, setRevealedEmail] = useState<string | null>(null);

  if (isLoading) {
    return <div style={{ color: "var(--admin-text-muted)" }}>Loading user details...</div>;
  }

  if (!user) {
    return <div style={{ color: "var(--admin-text-muted)" }}>User not found</div>;
  }

  const handleReveal = async () => {
    try {
      const res = await revealEmail({ userId: id });
      setRevealedEmail(res.email);
    } catch (e) {
      alert("Failed to reveal email");
    }
  };

  const handleSuspendToggle = async () => {
    try {
      if (user.isSuspended) {
        await unsuspendUser({ userId: id });
      } else {
        if (confirm("Are you sure you want to suspend this user?")) {
            await suspendUser({ userId: id });
        } else { return; }
      }
      refetch();
    } catch (e) {
      alert("Failed to update suspension status");
    }
  };

  const handleDelete = async () => {
    if (confirm("WARNING: This will permanently delete the user and all their data. Proceed?")) {
      try {
        await deleteUser({ userId: id });
        router.push("/users");
      } catch (e) {
        alert("Failed to delete user");
      }
    }
  };

  const initials = (user.name || "U").substring(0, 2).toUpperCase();

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {/* User Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
        <div className="admin-sidebar-avatar" style={{ width: 64, height: 64, fontSize: 22 }}>{initials}</div>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: "var(--admin-text)", margin: 0 }}>
            {user.name || "Unknown User"} {user.isSuspended && <span className="admin-badge admin-badge--warning" style={{marginLeft: 8}}>SUSPENDED</span>}
          </h1>
          <div style={{ display: "flex", gap: 12, marginTop: 6, fontSize: 13, color: "var(--admin-text-muted)", alignItems: "center" }}>
            <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
              📧 {revealedEmail || user.email}
              {!revealedEmail && (
                <button onClick={handleReveal} className="admin-btn admin-btn--ghost admin-btn--sm" style={{ padding: 2, height: 'auto' }} title="Reveal Email">
                  <span className="material-symbols-outlined" style={{ fontSize: 14 }}>visibility</span>
                </button>
              )}
            </span>
            <span>📱 {user.phone || "N/A"}</span>
            <span className={`admin-badge ${user.plan === "PRO" ? "admin-badge--pro" : "admin-badge--free"}`}>
              {user.plan} PLAN
            </span>
          </div>
        </div>
        <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
          <button className="admin-btn admin-btn--primary">Edit Profile</button>
          <button className="admin-btn admin-btn--secondary">More Actions</button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 0, borderBottom: "1px solid var(--admin-border)" }}>
        {["User Profile", "Transactions", "Support Tickets"].map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              padding: "12px 20px",
              fontSize: 14,
              fontWeight: 600,
              color: activeTab === tab ? "var(--admin-cyan)" : "var(--admin-text-muted)",
              background: "none",
              border: "none",
              borderBottom: activeTab === tab ? "2px solid var(--admin-cyan)" : "2px solid transparent",
              cursor: "pointer",
              fontFamily: "var(--font-sans)",
            }}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Content */}
      {activeTab === "User Profile" && (
        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 20 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            {/* Account Metadata */}
            <div className="admin-card">
              <h3 className="admin-card-title" style={{ marginBottom: 16 }}>Account Metadata</h3>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
                <div>
                  <p className="admin-kpi-label">User ID</p>
                  <p style={{ fontSize: 14, fontWeight: 600, color: "var(--admin-text)", margin: 0 }}>{user.id.substring(0, 16)}...</p>
                </div>
                <div>
                  <p className="admin-kpi-label">Date Joined</p>
                  <p style={{ fontSize: 14, fontWeight: 600, color: "var(--admin-text)", margin: 0 }}>
                    {new Date(user.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <div>
                  <p className="admin-kpi-label">TIN (Tax ID)</p>
                  <p style={{ fontSize: 14, fontWeight: 600, color: "var(--admin-text)", margin: 0 }}>
                    {user.taxIdentificationNumber || "Not Provided"}
                  </p>
                </div>
              </div>
            </div>

            {/* Workspace Summary */}
            <div className="admin-card">
              <div className="admin-card-header">
                <h3 className="admin-card-title">Workspace Summary</h3>
              </div>
              {user.workspaces.length === 0 ? (
                <p style={{ color: "var(--admin-text-muted)", margin: 0 }}>No workspaces found.</p>
              ) : (
                (user.workspaces as any[]).map((ws) => (
                  <div
                    key={ws.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "14px 0",
                      borderBottom: "1px solid var(--admin-border)",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <span style={{ fontSize: 18, fontWeight: 800, color: "var(--admin-cyan)" }}>{ws.taxYear}</span>
                      <div>
                        <p style={{ fontSize: 14, fontWeight: 600, color: "var(--admin-text)", margin: 0 }}>Tax Filing Year {ws.taxYear}</p>
                        <p style={{ fontSize: 12, color: "var(--admin-text-muted)", margin: "2px 0 0" }}>
                          {ws.statements.length} Statements Uploaded
                        </p>
                      </div>
                    </div>
                    <span className={`admin-badge ${ws.status === 'FILED' ? 'admin-badge--success' : 'admin-badge--warning'}`}>
                      {ws.status}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Right Column */}
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            {/* Danger Zone */}
            <div className="admin-card" style={{ borderColor: "rgba(239, 68, 68, 0.3)" }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, color: "#ef4444", margin: "0 0 8px" }}>Danger Zone</h3>
              <p style={{ fontSize: 12, color: "var(--admin-text-muted)", margin: "0 0 16px" }}>
                Admin actions that can disrupt user access or permanently remove data.
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <button
                  onClick={handleSuspendToggle}
                  disabled={isSuspending || isUnsuspending}
                  className={user.isSuspended ? "admin-btn admin-btn--secondary" : "admin-btn admin-btn--danger"}
                  style={{ width: "100%", justifyContent: "center" }}
                >
                  {user.isSuspended ? "Unsuspend Account" : "Suspend Account"}
                </button>
                <button className="admin-btn admin-btn--secondary" style={{ width: "100%", justifyContent: "center" }}>
                  Force Logout
                </button>
                <button
                  onClick={handleDelete}
                  disabled={isDeleting}
                  className="admin-btn admin-btn--danger"
                  style={{ width: "100%", justifyContent: "center" }}
                >
                  Delete Account
                </button>
              </div>
            </div>

            {/* Billing Summary */}
            <div className="admin-card">
              <p className="admin-kpi-label">Subscription</p>
              <p style={{ fontSize: 24, fontWeight: 800, color: "var(--admin-text)", margin: "8px 0 4px", textTransform: "uppercase" }}>
                {user.plan}
              </p>
              {user.subscription ? (
                <>
                  <p style={{ fontSize: 12, color: "var(--admin-text-muted)", margin: "0 0 12px" }}>
                    Status: {user.subscription.status}
                  </p>
                </>
              ) : (
                <p style={{ fontSize: 12, color: "var(--admin-text-muted)", margin: "0 0 12px" }}>No active subscription record.</p>
              )}
            </div>
          </div>
        </div>
      )}

      {activeTab === "Transactions" && (
        <div className="admin-card">
          <p style={{ color: "var(--admin-text-muted)" }}>Billing history will be securely loaded here from Paystack API.</p>
        </div>
      )}

      {activeTab === "Support Tickets" && (
        <div className="admin-card">
           <p style={{ color: "var(--admin-text-muted)" }}>Support tickets for this user will appear here.</p>
        </div>
      )}
    </div>
  );
}
