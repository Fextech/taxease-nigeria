"use client";

import { use, useState } from "react";
import { trpc } from "@/lib/trpc";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

export default function UserDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();

  const [activeTab, setActiveTab] = useState("User Profile");

  const { data: user, isLoading, refetch } = trpc.admin.users.getUserDetails.useQuery({ id });
  
  const { mutateAsync: suspendUser, isPending: isSuspending } = trpc.admin.users.suspendUser.useMutation();
  const { mutateAsync: unsuspendUser, isPending: isUnsuspending } = trpc.admin.users.unsuspendUser.useMutation();
  const { mutateAsync: deleteUser, isPending: isDeleting } = trpc.admin.users.deleteUser.useMutation();
  const { mutateAsync: forceLogout, isPending: isLoggingOut } = trpc.admin.users.forceLogout.useMutation();
  
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
      toast.success("Email revealed successfully");
    } catch (e) {
      toast.error("Failed to reveal email");
    }
  };

  const handleSuspendToggle = () => {
    const isSusp = user.isSuspended;
    toast.error(isSusp ? "Unsuspend this user?" : "Suspend this user?", {
      description: isSusp ? "They will regain access." : "They will be immediately locked out.",
      action: {
        label: "Confirm",
        onClick: async () => {
          try {
            if (isSusp) await unsuspendUser({ userId: id });
            else await suspendUser({ userId: id });
            refetch();
            toast.success(isSusp ? "User unsuspended" : "User suspended");
          } catch (e: any) {
            toast.error(e.message || "Failed to update suspension status");
          }
        }
      },
      cancel: { label: "Cancel", onClick: () => {} }
    });
  };

  const handleDelete = () => {
    toast.error("Delete this user?", {
      description: "WARNING: This permanently deletes the user and all their data. Cannot be undone.",
      action: {
        label: "Delete",
        onClick: async () => {
          try {
            await deleteUser({ userId: id });
            toast.success("User deleted completely.");
            router.push("/users");
          } catch (e: any) {
            toast.error(e.message || "Failed to delete user");
          }
        }
      },
      cancel: { label: "Cancel", onClick: () => {} }
    });
  };

  const handleForceLogout = () => {
    toast.error("Force logout?", {
      description: "This will destroy all active sessions for this user.",
      action: {
        label: "Logout User",
        onClick: async () => {
          try {
            await forceLogout({ userId: id });
            toast.success("User sessions destroyed.");
          } catch (e: any) {
            toast.error(e.message || "Failed to force logout");
          }
        }
      },
      cancel: { label: "Cancel", onClick: () => {} }
    });
  };

  const initials = (user.name || "U").substring(0, 2).toUpperCase();

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <button 
        onClick={() => router.push('/users')} 
        className="admin-btn admin-btn--ghost admin-btn--sm" 
        style={{ width: "fit-content", marginBottom: -8, color: "var(--admin-text-muted)" }}
      >
        <span className="material-symbols-outlined" style={{ fontSize: 16 }}>arrow_back</span> 
        Back to Users
      </button>

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
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <p style={{ fontSize: 14, fontWeight: 600, color: "var(--admin-text)", margin: 0 }}>Tax Year {ws.taxYear}</p>
                          <span className={`admin-badge ${ws.isUnlocked ? "admin-badge--pro" : "admin-badge--free"}`} style={{ fontSize: 10, padding: "2px 6px" }}>
                            {ws.isUnlocked ? "PRO" : "FREE"}
                          </span>
                        </div>
                        <p style={{ fontSize: 12, color: "var(--admin-text-muted)", margin: "4px 0 0" }}>
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
                <button 
                  onClick={handleForceLogout}
                  disabled={isLoggingOut}
                  className="admin-btn admin-btn--secondary" 
                  style={{ width: "100%", justifyContent: "center" }}
                >
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
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {!user.supportTickets || user.supportTickets.length === 0 ? (
            <div className="admin-card">
              <p style={{ color: "var(--admin-text-muted)", margin: 0 }}>No support tickets found for this user.</p>
            </div>
          ) : (
            user.supportTickets.map((ticket: any) => (
              <div key={ticket.id} className="admin-card" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <h4 style={{ margin: "0 0 6px", fontSize: 15, color: "var(--admin-text)" }}>{ticket.subject}</h4>
                  <div style={{ display: "flex", gap: 12, fontSize: 12, color: "var(--admin-text-muted)" }}>
                    <span style={{ textTransform: "capitalize" }}>📂 {ticket.category.toLowerCase().replace('_', ' ')}</span>
                    <span>📅 {new Date(ticket.createdAt).toLocaleDateString()}</span>
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <span className={`admin-badge ${ticket.status === 'OPEN' ? 'admin-badge--warning' : 'admin-badge--success'}`}>
                    {ticket.status}
                  </span>
                  <button className="admin-btn admin-btn--secondary admin-btn--sm">View Ticket</button>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
