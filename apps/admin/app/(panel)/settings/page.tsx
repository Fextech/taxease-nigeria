"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useForm } from "react-hook-form";

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState('profile');
  const utils = trpc.useUtils();

  // Profile Data
  const { data: profile } = trpc.admin.settings.getAdminProfile.useQuery();
  const updateProfile = trpc.admin.settings.updateAdminProfile.useMutation({
      onSuccess: () => {
          alert('Profile updated successfully');
          utils.admin.settings.getAdminProfile.invalidate();
      }
  });

  // Security Data
  const changePassword = trpc.admin.settings.changePassword.useMutation({
      onSuccess: () => alert('Password changed successfully'),
      onError: (err) => alert(err.message)
  });

  // Sessions Data
  const { data: sessions } = trpc.admin.settings.listSessions.useQuery();
  const revokeSession = trpc.admin.settings.revokeSession.useMutation({
      onSuccess: () => utils.admin.settings.listSessions.invalidate()
  });

  // Integrations Data
  const { data: integrations } = trpc.admin.settings.getIntegrationStatuses.useQuery();
  const pingIntegration = trpc.admin.settings.pingIntegration.useMutation();

  const handlePing = async (service: string) => {
    try {
        const res = await pingIntegration.mutateAsync({ service });
        alert(`Ping successful! Latency: ${res.latency}ms, Status: ${res.status}`);
    } catch (e) {
        alert("Ping failed");
    }
  };

  // Profile Form
  const { register: regProfile, handleSubmit: submitProfile } = useForm({
    defaultValues: { fullName: profile?.fullName || "" },
    values: { fullName: profile?.fullName || "" }
  });

  // Password Form
  const { register: regPassword, handleSubmit: submitPassword, reset: resetPassword } = useForm({
    defaultValues: { currentPassword: "", newPassword: "" }
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <div>
        <h1 style={{ fontSize: 24, fontWeight: 800, color: "var(--admin-text)", margin: "0 0 8px" }}>Platform Settings</h1>
        <p style={{ color: "var(--admin-text-muted)", margin: 0, fontSize: 14 }}>
          Manage your account profile, security preferences, and system integrations.
        </p>
      </div>

      <div style={{ display: "flex", gap: 24, alignItems: "flex-start" }}>
        {/* Sidebar Nav */}
        <div style={{ width: 240, display: "flex", flexDirection: "column", gap: 4 }}>
          {[
            { id: 'profile', icon: 'person', label: 'Admin Profile' },
            { id: 'security', icon: 'lock', label: 'Security & 2FA' },
            { id: 'sessions', icon: 'devices', label: 'Active Sessions' },
            { id: 'integrations', icon: 'hub', label: 'Integrations' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                display: "flex", alignItems: "center", gap: 12, padding: "12px 16px",
                border: "none", borderRadius: 8, cursor: "pointer",
                background: activeTab === tab.id ? "rgba(0, 240, 255, 0.1)" : "transparent",
                color: activeTab === tab.id ? "var(--admin-cyan)" : "var(--admin-text-muted)",
                textAlign: "left", transition: "all 0.2s"
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 20 }}>{tab.icon}</span>
              <span style={{ fontSize: 14, fontWeight: activeTab === tab.id ? 600 : 400 }}>{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Content Area */}
        <div className="admin-card" style={{ flex: 1, padding: 32, minHeight: 400 }}>
          
          {/* PROFILE */}
          {activeTab === 'profile' && (
            <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
                <h2 style={{ fontSize: 18, color: "var(--admin-text)", margin: 0 }}>Admin Profile</h2>
                
                <form onSubmit={submitProfile((data: any) => updateProfile.mutate(data))} style={{ display: "flex", flexDirection: "column", gap: 20, maxWidth: 400 }}>
                    <div>
                        <label style={{ display: "block", fontSize: 12, color: "var(--admin-text-muted)", marginBottom: 8 }}>Email Address (Read-only)</label>
                        <input type="text" className="admin-input" disabled value={profile?.email || ""} style={{ opacity: 0.6 }} />
                    </div>
                    <div>
                        <label style={{ display: "block", fontSize: 12, color: "var(--admin-text-muted)", marginBottom: 8 }}>Role</label>
                        <span className="admin-badge admin-badge--dim" style={{ textTransform: "uppercase" }}>{profile?.role || "ADMIN"}</span>
                    </div>
                    <div>
                        <label style={{ display: "block", fontSize: 12, color: "var(--admin-text-muted)", marginBottom: 8 }}>Full Name</label>
                        <input type="text" className="admin-input" {...regProfile("fullName", { required: true })} />
                    </div>
                    <div>
                        <button type="submit" className="admin-btn admin-btn--primary" disabled={updateProfile.isPending}>
                            {updateProfile.isPending ? "Saving..." : "Save Changes"}
                        </button>
                    </div>
                </form>
            </div>
          )}

          {/* SECURITY */}
          {activeTab === 'security' && (
            <div style={{ display: "flex", flexDirection: "column", gap: 32 }}>
                <div>
                    <h2 style={{ fontSize: 18, color: "var(--admin-text)", margin: "0 0 8px" }}>Change Password</h2>
                    <form onSubmit={submitPassword((data: any) => {
                        changePassword.mutate(data, { onSuccess: () => resetPassword() });
                    })} style={{ display: "flex", flexDirection: "column", gap: 20, maxWidth: 400 }}>
                        <div>
                            <label style={{ display: "block", fontSize: 12, color: "var(--admin-text-muted)", marginBottom: 8 }}>Current Password</label>
                            <input type="password" className="admin-input" {...regPassword("currentPassword", { required: true })} />
                        </div>
                        <div>
                            <label style={{ display: "block", fontSize: 12, color: "var(--admin-text-muted)", marginBottom: 8 }}>New Password</label>
                            <input type="password" className="admin-input" {...regPassword("newPassword", { required: true, minLength: 8 })} />
                        </div>
                        <div>
                            <button type="submit" className="admin-btn admin-btn--primary" disabled={changePassword.isPending}>
                                {changePassword.isPending ? "Updating..." : "Update Password"}
                            </button>
                        </div>
                    </form>
                </div>

                <div style={{ height: 1, backgroundColor: "rgba(255,255,255,0.05)" }}></div>

                <div>
                    <h2 style={{ fontSize: 18, color: "var(--admin-text)", margin: "0 0 8px" }}>Two-Factor Authentication (2FA)</h2>
                    <p style={{ fontSize: 13, color: "var(--admin-text-muted)" }}>
                        TOTP is {profile?.totpEnabled ? <strong style={{ color: "var(--admin-success)" }}>Enabled</strong> : "Disabled"} on your account.
                        Admins must establish 2FA per platform security policy.
                    </p>
                    <button className="admin-btn admin-btn--secondary" onClick={() => alert("Redirecting to 2FA Setup...")} style={{ marginTop: 16 }}>
                        Manage 2FA Settings
                    </button>
                </div>
            </div>
          )}

          {/* SESSIONS */}
          {activeTab === 'sessions' && (
            <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
                <h2 style={{ fontSize: 18, color: "var(--admin-text)", margin: 0 }}>Active Admin Sessions</h2>
                <p style={{ fontSize: 13, color: "var(--admin-text-muted)", margin: 0 }}>
                    Manage devices and IPs currently logged into your admin account.
                </p>

                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    {sessions?.map((session: any) => (
                        <div key={session.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 20px", background: "rgba(255,255,255,0.02)", borderRadius: 8, border: "1px solid rgba(255,255,255,0.05)" }}>
                            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                    <span style={{ fontSize: 14, fontWeight: 600, color: "var(--admin-text)" }}>
                                        {session.deviceFingerprint || "Unknown Device"}
                                    </span>
                                    {session.revokedAt ? (
                                        <span className="admin-badge" style={{ background: "rgba(255,0,0,0.1)", color: "var(--admin-error)" }}>Revoked</span>
                                    ) : (
                                        <span className="admin-badge admin-badge--dim">Active</span>
                                    )}
                                </div>
                                <span style={{ fontSize: 12, color: "var(--admin-text-muted)" }}>
                                    IP: {session.ipAddress || "Unknown"} · Last active: {new Date(session.lastActiveAt).toLocaleString()}
                                </span>
                            </div>
                            <button 
                                className="admin-btn admin-btn--ghost admin-btn--sm"
                                disabled={!!session.revokedAt}
                                onClick={() => revokeSession.mutate({ sessionId: session.id })}
                                style={{ color: "var(--admin-error)" }}
                            >
                                Revoke Access
                            </button>
                        </div>
                    ))}
                    {sessions?.length === 0 && (
                        <div style={{ padding: 40, textAlign: "center", color: "var(--admin-text-muted)" }}>No sessions found.</div>
                    )}
                </div>
            </div>
          )}

          {/* INTEGRATIONS */}
          {activeTab === 'integrations' && (
            <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
                <h2 style={{ fontSize: 18, color: "var(--admin-text)", margin: 0 }}>Integration Connection Status</h2>
                
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                    {integrations && Object.entries(integrations).map(([key, data]) => (
                        <div key={key} style={{ display: "flex", flexDirection: "column", gap: 12, padding: "20px", background: "rgba(255,255,255,0.02)", borderRadius: 8, border: "1px solid rgba(255,255,255,0.05)" }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                <span style={{ fontSize: 16, fontWeight: 600, color: "var(--admin-text)", textTransform: "capitalize" }}>
                                    {key === 's3' ? 'AWS S3' : key}
                                </span>
                                <span className="admin-badge" style={{ 
                                    background: data.status === 'healthy' ? "rgba(0, 255, 128, 0.1)" : "rgba(255, 165, 0, 0.1)", 
                                    color: data.status === 'healthy' ? "var(--admin-success)" : "var(--admin-warning)" 
                                }}>
                                    {data.status}
                                </span>
                            </div>
                            <span style={{ fontSize: 12, color: "var(--admin-text-muted)" }}>
                                Last check: {new Date(data.lastPing).toLocaleString()}
                            </span>
                            <button 
                                className="admin-btn admin-btn--secondary admin-btn--sm" 
                                style={{ alignSelf: "flex-start", marginTop: 8 }}
                                onClick={() => handlePing(key)}
                                disabled={pingIntegration.isPending}
                            >
                                Ping Service
                            </button>
                        </div>
                    ))}
                </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
