"use client";

import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

const AI_PROVIDER_ICONS: Record<string, string> = {
  GEMINI: "auto_awesome",
  OPENAI: "neurology",
  NVIDIA_NIM: "memory",
  OPENROUTER: "account_tree",
};

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

  // AI Model Routing
  const { data: aiModelSettings } = trpc.admin.settings.getAiProviderConfigs.useQuery();
  const {
    data: providerModelLists,
    refetch: refetchProviderModels,
    isFetching: isFetchingProviderModels,
  } = trpc.admin.settings.getAiProviderModels.useQuery(undefined, {
    enabled: activeTab === "ai-model",
    staleTime: 5 * 60 * 1000,
    retry: false,
  });
  const [aiModels, setAiModels] = useState<Record<string, string>>({});
  const [aiApiKeys, setAiApiKeys] = useState<Record<string, string>>({});
  const [selectedAiProvider, setSelectedAiProvider] = useState<string>("");
  const [showRecommendations, setShowRecommendations] = useState(false);
  const saveAiProvider = trpc.admin.settings.saveAiProviderConfig.useMutation({
      onSuccess: (_, variables) => {
          setAiApiKeys((current) => ({ ...current, [variables.provider]: "" }));
          utils.admin.settings.getAiProviderConfigs.invalidate();
          utils.admin.settings.getAiProviderModels.invalidate();
          toast.success("AI provider settings saved");
      },
      onError: (err) => toast.error(err.message),
  });
  const removeAiProvider = trpc.admin.settings.removeAiProviderConfig.useMutation({
    onSuccess: (_, variables) => {
      setAiApiKeys((current) => ({ ...current, [variables.provider]: "" }));
      setAiModels((current) => {
        const next = { ...current };
        delete next[variables.provider];
        return next;
      });
      utils.admin.settings.getAiProviderConfigs.invalidate();
      utils.admin.settings.getAiProviderModels.invalidate();
      toast.success("Saved provider key removed");
    },
    onError: (err) => toast.error(err.message),
  });

  useEffect(() => {
    if (!aiModelSettings) return;
    setAiModels((current) => {
      const next = { ...current };
      for (const provider of aiModelSettings.providers) {
        if (!next[provider.id]) next[provider.id] = provider.model;
      }
      return next;
    });
    const activeProvider = aiModelSettings.providers.find((provider) => provider.isActive);
    if (activeProvider) setSelectedAiProvider(activeProvider.id);
  }, [aiModelSettings]);

  // Maintenance Data
  const { data: maintenanceData, refetch: refetchMaintenance } = trpc.admin.settings.getMaintenanceConfig.useQuery();
  const updateMaintenance = trpc.admin.settings.updateMaintenanceConfig.useMutation({
      onSuccess: () => { refetchMaintenance(); toast.success('Maintenance settings saved!'); },
      onError: (err) => toast.error(err.message)
  });
  const toggleMaintenance = trpc.admin.settings.toggleMaintenanceMode.useMutation({
      onSuccess: () => { refetchMaintenance(); toast.success('Maintenance mode toggled!'); },
      onError: (err) => toast.error(err.message)
  });
  const [maintenanceHtml, setMaintenanceHtml] = useState('');
  const [maintenanceEnabled, setMaintenanceEnabled] = useState(false);

  useEffect(() => {
    if (maintenanceData) {
      setMaintenanceHtml(maintenanceData.html);
      setMaintenanceEnabled(maintenanceData.enabled);
    }
  }, [maintenanceData]);

  // How To Guide Data
  const { data: howToData, refetch: refetchHowTo } = trpc.admin.settings.getHowToGuide.useQuery();
  const updateHowTo = trpc.admin.settings.updateHowToGuide.useMutation({
      onSuccess: () => { refetchHowTo(); toast.success('How-To guide saved!'); },
      onError: (err) => toast.error(err.message)
  });
  const [howToPages, setHowToPages] = useState<string[]>([]);
  const [activeHowToPageIdx, setActiveHowToPageIdx] = useState<number>(0);

  useEffect(() => {
    if (howToData) {
      setHowToPages(howToData.pages.length > 0 ? howToData.pages : ['<h2 style="color:#fff;">Welcome to TaxEase</h2><p>Here is how to use the app.</p>']);
      setActiveHowToPageIdx(0);
    }
  }, [howToData]);

  const handlePing = async (service: string) => {
    try {
        const res = await pingIntegration.mutateAsync({ service });
        alert(`Ping successful! Latency: ${res.latency}ms, Status: ${res.status}`);
    } catch (e) {
        alert("Ping failed");
    }
  };

  const refreshProviderModels = async () => {
    const result = await refetchProviderModels();
    if (result.error) {
      toast.error("Could not refresh provider model lists");
      return;
    }
    toast.success("Provider model lists refreshed");
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
            { id: 'ai-model', icon: 'smart_toy', label: 'AI Model' },
            { id: 'maintenance', icon: 'construction', label: 'Maintenance Mode' },
            { id: 'howto', icon: 'school', label: 'How-To Guide' },
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
                                    {key === 's3' ? 'AWS S3' : key === 'aiModel' ? 'AI Model Routing' : key}
                                </span>
                                <span className="admin-badge" style={{ 
                                    background: data.status === 'healthy' ? "rgba(0, 255, 128, 0.1)" : "rgba(255, 165, 0, 0.1)", 
                                    color: data.status === 'healthy' ? "var(--admin-success)" : "var(--admin-warning)" 
                                }}>
                                    {data.status}
                                </span>
                            </div>
                            <span style={{ fontSize: 12, color: "var(--admin-text-muted)" }}>
                                {data.detail ? `${data.detail} · ` : ""}Last check: {new Date(data.lastPing).toLocaleString()}
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

          {/* AI MODEL */}
          {activeTab === 'ai-model' && (
            <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 20 }}>
                <div>
                  <h2 style={{ fontSize: 18, color: "var(--admin-text)", margin: 0 }}>AI Model Routing</h2>
                  <p style={{ fontSize: 13, color: "var(--admin-text-muted)", margin: "6px 0 0", maxWidth: 620 }}>
                    Store provider keys securely, choose the model for each provider, and select one active model for statement extraction.
                  </p>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
                  <button
                    className="admin-btn admin-btn--secondary admin-btn--sm"
                    onClick={() => void refreshProviderModels()}
                    disabled={isFetchingProviderModels}
                    style={{ display: "inline-flex", alignItems: "center", gap: 6, whiteSpace: "nowrap" }}
                    title="Reload the available models from each saved provider"
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: 16 }}>{isFetchingProviderModels ? "progress_activity" : "refresh"}</span>
                    {isFetchingProviderModels ? "Refreshing…" : "Refresh models"}
                  </button>
                  <button
                    className="admin-btn admin-btn--secondary admin-btn--sm"
                    onClick={() => setShowRecommendations(true)}
                    style={{ display: "inline-flex", alignItems: "center", gap: 6, whiteSpace: "nowrap" }}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: 16 }}>info</span>
                    Recommended models
                  </button>
                </div>
              </div>

              <div style={{ padding: "14px 16px", borderRadius: 10, border: "1px solid rgba(0, 240, 255, 0.16)", background: "rgba(0, 240, 255, 0.05)", display: "flex", gap: 10, alignItems: "flex-start" }}>
                <span className="material-symbols-outlined" style={{ color: "var(--admin-cyan)", fontSize: 19 }}>shield_lock</span>
                <p style={{ color: "var(--admin-text-muted)", fontSize: 12, margin: 0, lineHeight: 1.55 }}>
                  API keys are encrypted before storage and are never returned to this page. Enter a replacement key only when you need to rotate it.
                </p>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 16 }}>
                {aiModelSettings?.providers.map((provider) => {
                  const isSelected = selectedAiProvider === provider.id;
                  const liveModelList = providerModelLists?.providers.find((item) => item.provider === provider.id);
                  const modelOptions = Array.from(new Map([
                    ...(liveModelList?.models ?? []),
                    { id: provider.model, label: provider.model },
                    ...((liveModelList?.models.length ?? 0) > 0 ? [] : provider.recommendedModels),
                  ].map((model) => [model.id, model])).values());
                  return (
                    <div key={provider.id} style={{ padding: 20, borderRadius: 12, border: isSelected ? "1px solid var(--admin-cyan)" : "1px solid rgba(255,255,255,0.08)", background: isSelected ? "rgba(0, 240, 255, 0.045)" : "rgba(255,255,255,0.02)", display: "flex", flexDirection: "column", gap: 16 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
                        <div style={{ display: "flex", gap: 10 }}>
                          <span className="material-symbols-outlined" style={{ color: "var(--admin-cyan)", fontSize: 22 }}>{AI_PROVIDER_ICONS[provider.id]}</span>
                          <div>
                            <h3 style={{ color: "var(--admin-text)", fontSize: 15, margin: 0 }}>{provider.label}</h3>
                            <p style={{ color: "var(--admin-text-muted)", fontSize: 12, lineHeight: 1.45, margin: "4px 0 0" }}>{provider.description}</p>
                          </div>
                        </div>
                        {provider.apiKeyConfigured && <span className="admin-badge admin-badge--dim">Key saved</span>}
                      </div>

                      <label style={{ display: "flex", gap: 8, alignItems: "center", color: "var(--admin-text-muted)", fontSize: 12, cursor: "pointer" }}>
                        <input type="radio" name="active-ai-provider" checked={isSelected} onChange={() => setSelectedAiProvider(provider.id)} />
                        Use this provider for new statement jobs
                      </label>

                      <div>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 7 }}>
                          <label style={{ display: "block", fontSize: 11, color: "var(--admin-text-muted)", textTransform: "uppercase", letterSpacing: 0.7 }}>Model</label>
                          <button
                            type="button"
                            onClick={() => void refreshProviderModels()}
                            disabled={isFetchingProviderModels || !provider.apiKeyConfigured}
                            title={provider.apiKeyConfigured ? `Refresh ${provider.label} models` : "Save an API key before refreshing models"}
                            style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: 0, border: "none", background: "transparent", color: "var(--admin-cyan)", cursor: provider.apiKeyConfigured ? "pointer" : "not-allowed", fontSize: 11, opacity: provider.apiKeyConfigured ? 1 : 0.5 }}
                          >
                            <span className="material-symbols-outlined" style={{ fontSize: 14 }}>{isFetchingProviderModels ? "progress_activity" : "refresh"}</span>
                            Refresh
                          </button>
                        </div>
                        <select
                          className="admin-input"
                          value={aiModels[provider.id] ?? provider.model}
                          onChange={(event) => setAiModels((current) => ({ ...current, [provider.id]: event.target.value }))}
                        >
                          {modelOptions.map((model) => (
                            <option key={model.id} value={model.id}>{model.label === model.id ? model.id : `${model.label} — ${model.id}`}</option>
                          ))}
                        </select>
                        {liveModelList?.error ? (
                          <p style={{ color: "var(--admin-warning)", fontSize: 11, margin: "7px 0 0", lineHeight: 1.4 }}>{liveModelList.error}</p>
                        ) : liveModelList ? (
                          <p style={{ color: "var(--admin-text-muted)", fontSize: 11, margin: "7px 0 0" }}>{liveModelList.models.length} live model{liveModelList.models.length === 1 ? "" : "s"} available</p>
                        ) : null}
                      </div>

                      <div>
                        <label style={{ display: "block", fontSize: 11, color: "var(--admin-text-muted)", marginBottom: 7, textTransform: "uppercase", letterSpacing: 0.7 }}>
                          {provider.apiKeyConfigured ? "Replace API key (optional)" : "API key"}
                        </label>
                        <input
                          type="password"
                          autoComplete="new-password"
                          className="admin-input"
                          value={aiApiKeys[provider.id] ?? ""}
                          onChange={(event) => setAiApiKeys((current) => ({ ...current, [provider.id]: event.target.value }))}
                          placeholder={provider.apiKeyConfigured ? "Leave blank to keep the stored key" : "Paste provider API key"}
                        />
                        {provider.apiKeyConfigured && (
                          <button
                            type="button"
                            disabled={removeAiProvider.isPending}
                            onClick={() => {
                              if (window.confirm(`Remove the saved ${provider.label} API key? You can add it again later.`)) {
                                removeAiProvider.mutate({ provider: provider.id });
                              }
                            }}
                            style={{ display: "inline-flex", alignItems: "center", gap: 5, marginTop: 8, padding: 0, border: "none", background: "transparent", color: "var(--admin-error)", cursor: "pointer", fontSize: 11 }}
                          >
                            <span className="material-symbols-outlined" style={{ fontSize: 14 }}>delete</span>
                            Remove saved key
                          </button>
                        )}
                      </div>

                      <button
                        className="admin-btn admin-btn--primary"
                        disabled={saveAiProvider.isPending}
                        onClick={() => saveAiProvider.mutate({
                          provider: provider.id,
                          model: aiModels[provider.id] ?? provider.model,
                          apiKey: aiApiKeys[provider.id] || undefined,
                          isActive: isSelected,
                        })}
                        style={{ alignSelf: "flex-start" }}
                      >
                        {saveAiProvider.isPending ? "Saving..." : "Save provider"}
                      </button>
                    </div>
                  );
                })}
              </div>

              {!aiModelSettings && <p style={{ color: "var(--admin-text-muted)", fontSize: 13, margin: 0 }}>Loading AI providers…</p>}
            </div>
          )}

          {/* MAINTENANCE MODE */}
          {activeTab === 'maintenance' && (
            <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                        <h2 style={{ fontSize: 18, color: "var(--admin-text)", margin: 0 }}>Maintenance Mode</h2>
                        <p style={{ fontSize: 13, color: "var(--admin-text-muted)", margin: "4px 0 0" }}>
                            When enabled, the sign-up page will redirect users to a maintenance page.
                        </p>
                    </div>
                    <button
                        onClick={() => {
                            const newVal = !maintenanceEnabled;
                            setMaintenanceEnabled(newVal);
                            toggleMaintenance.mutate({ enabled: newVal });
                        }}
                        style={{
                            display: "flex", alignItems: "center", gap: 10, padding: "10px 20px",
                            borderRadius: 8, border: "none", cursor: "pointer", fontWeight: 600, fontSize: 13,
                            background: maintenanceEnabled ? "rgba(239, 68, 68, 0.15)" : "rgba(0, 240, 255, 0.1)",
                            color: maintenanceEnabled ? "#ef4444" : "var(--admin-cyan)",
                            transition: "all 0.2s"
                        }}
                    >
                        <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
                            {maintenanceEnabled ? "toggle_on" : "toggle_off"}
                        </span>
                        {maintenanceEnabled ? "Maintenance ON — Sign-ups Blocked" : "Maintenance OFF — Sign-ups Open"}
                    </button>
                </div>

                <div style={{ height: 1, backgroundColor: "rgba(255,255,255,0.05)" }}></div>

                <div>
                    <h3 style={{ fontSize: 14, fontWeight: 600, color: "var(--admin-text)", margin: "0 0 12px" }}>Page Content (HTML)</h3>
                    <p style={{ fontSize: 12, color: "var(--admin-text-muted)", margin: "0 0 16px" }}>
                        Write raw HTML below. It will be embedded inside the maintenance page between the header and footer.
                    </p>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, minHeight: 400 }}>
                        {/* Editor */}
                        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                            <span style={{ fontSize: 11, fontWeight: 700, color: "var(--admin-text-muted)", textTransform: "uppercase", letterSpacing: 1 }}>HTML Editor</span>
                            <textarea
                                value={maintenanceHtml}
                                onChange={(e) => setMaintenanceHtml(e.target.value)}
                                spellCheck={false}
                                style={{
                                    flex: 1, fontFamily: "'JetBrains Mono', 'Fira Code', monospace", fontSize: 13,
                                    lineHeight: 1.6, padding: 16, borderRadius: 8, resize: "vertical",
                                    background: "rgba(0,0,0,0.3)", color: "#e2e8f0", border: "1px solid rgba(255,255,255,0.08)",
                                    outline: "none", minHeight: 360,
                                }}
                                placeholder='<h2 style="color:#fff;">Under Maintenance</h2>'
                            />
                        </div>
                        {/* Preview */}
                        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                            <span style={{ fontSize: 11, fontWeight: 700, color: "var(--admin-text-muted)", textTransform: "uppercase", letterSpacing: 1 }}>Live Preview</span>
                            <div style={{
                                flex: 1, borderRadius: 8, border: "1px solid rgba(255,255,255,0.08)",
                                overflow: "hidden", background: "#0f1c1e", minHeight: 360,
                            }}>
                                <iframe
                                    srcDoc={`<!DOCTYPE html><html><head><meta charset="utf-8"><style>body{margin:0;padding:24px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#0f1c1e;color:#cbd5e1;}</style></head><body>${maintenanceHtml}</body></html>`}
                                    style={{ width: "100%", height: "100%", border: "none", minHeight: 360 }}
                                    sandbox="allow-same-origin"
                                    title="Maintenance page preview"
                                />
                            </div>
                        </div>
                    </div>
                </div>

                <div style={{ display: "flex", justifyContent: "flex-end", gap: 12, marginTop: 8 }}>
                    <button
                        className="admin-btn admin-btn--primary"
                        disabled={updateMaintenance.isPending}
                        onClick={() => updateMaintenance.mutate({ enabled: maintenanceEnabled, html: maintenanceHtml })}
                    >
                        {updateMaintenance.isPending ? "Saving..." : "Save Maintenance Page"}
                    </button>
                </div>
            </div>
          )}

          {/* HOW-TO GUIDE */}
          {activeTab === 'howto' && (
            <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div>
                        <h2 style={{ fontSize: 18, color: "var(--admin-text)", margin: 0 }}>How-To Guide (Onboarding)</h2>
                        <p style={{ fontSize: 13, color: "var(--admin-text-muted)", margin: "4px 0 0" }}>
                            Manage the pages of the onboarding pop-up shown to users on their first login.
                        </p>
                    </div>
                </div>

                <div style={{ display: "flex", gap: 12, overflowX: "auto", paddingBottom: 8 }}>
                    {howToPages.map((_, idx) => (
                        <button
                            key={idx}
                            onClick={() => setActiveHowToPageIdx(idx)}
                            style={{
                                padding: "8px 16px",
                                borderRadius: 8,
                                border: activeHowToPageIdx === idx ? "1px solid var(--admin-cyan)" : "1px solid rgba(255,255,255,0.1)",
                                background: activeHowToPageIdx === idx ? "rgba(0, 240, 255, 0.1)" : "transparent",
                                color: activeHowToPageIdx === idx ? "var(--admin-cyan)" : "var(--admin-text-muted)",
                                cursor: "pointer",
                                fontSize: 13,
                                fontWeight: 600,
                                flexShrink: 0
                            }}
                        >
                            Page {idx + 1}
                        </button>
                    ))}
                    <button
                        onClick={() => {
                            setHowToPages([...howToPages, '<h2 style="color:#fff;">New Page</h2>']);
                            setActiveHowToPageIdx(howToPages.length);
                        }}
                        style={{
                            padding: "8px 16px",
                            borderRadius: 8,
                            border: "1px dashed rgba(255,255,255,0.2)",
                            background: "transparent",
                            color: "var(--admin-text-muted)",
                            cursor: "pointer",
                            fontSize: 13,
                            display: "flex", alignItems: "center", gap: 6,
                            flexShrink: 0
                        }}
                    >
                        <span className="material-symbols-outlined" style={{ fontSize: 16 }}>add</span>
                        Add Page
                    </button>
                </div>

                <div style={{ height: 1, backgroundColor: "rgba(255,255,255,0.05)" }}></div>

                <div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                        <h3 style={{ fontSize: 14, fontWeight: 600, color: "var(--admin-text)", margin: 0 }}>Page {activeHowToPageIdx + 1} Content (HTML)</h3>
                        {howToPages.length > 1 && (
                            <button
                                onClick={() => {
                                    const newPages = [...howToPages];
                                    newPages.splice(activeHowToPageIdx, 1);
                                    setHowToPages(newPages);
                                    setActiveHowToPageIdx(Math.max(0, activeHowToPageIdx - 1));
                                }}
                                style={{
                                    border: "none", background: "transparent", color: "#ef4444", 
                                    cursor: "pointer", fontSize: 12, display: "flex", alignItems: "center", gap: 4
                                }}
                            >
                                <span className="material-symbols-outlined" style={{ fontSize: 14 }}>delete</span>
                                Remove Page
                            </button>
                        )}
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, minHeight: 400 }}>
                        {/* Editor */}
                        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                            <span style={{ fontSize: 11, fontWeight: 700, color: "var(--admin-text-muted)", textTransform: "uppercase", letterSpacing: 1 }}>HTML Editor</span>
                            <textarea
                                value={howToPages[activeHowToPageIdx] || ""}
                                onChange={(e) => {
                                    const newPages = [...howToPages];
                                    newPages[activeHowToPageIdx] = e.target.value;
                                    setHowToPages(newPages);
                                }}
                                spellCheck={false}
                                style={{
                                    flex: 1, fontFamily: "'JetBrains Mono', 'Fira Code', monospace", fontSize: 13,
                                    lineHeight: 1.6, padding: 16, borderRadius: 8, resize: "vertical",
                                    background: "rgba(0,0,0,0.3)", color: "#e2e8f0", border: "1px solid rgba(255,255,255,0.08)",
                                    outline: "none", minHeight: 360,
                                }}
                            />
                        </div>
                        {/* Preview */}
                        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                            <span style={{ fontSize: 11, fontWeight: 700, color: "var(--admin-text-muted)", textTransform: "uppercase", letterSpacing: 1 }}>Live Preview</span>
                            <div style={{
                                flex: 1, borderRadius: 8, border: "1px solid rgba(255,255,255,0.08)",
                                overflow: "hidden", background: "#0f1c1e", minHeight: 360,
                            }}>
                                <iframe
                                    srcDoc={`<!DOCTYPE html><html><head><meta charset="utf-8"><style>body{margin:0;padding:24px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#0f1c1e;color:#cbd5e1;}</style></head><body>${howToPages[activeHowToPageIdx] || ""}</body></html>`}
                                    style={{ width: "100%", height: "100%", border: "none", minHeight: 360 }}
                                    sandbox="allow-same-origin"
                                    title="How-To slide preview"
                                />
                            </div>
                        </div>
                    </div>
                </div>

                <div style={{ display: "flex", justifyContent: "flex-end", gap: 12, marginTop: 8 }}>
                    <button
                        className="admin-btn admin-btn--primary"
                        disabled={updateHowTo.isPending}
                        onClick={() => updateHowTo.mutate({ pages: howToPages })}
                    >
                        {updateHowTo.isPending ? "Saving..." : "Save How-To Guide"}
                    </button>
                </div>
            </div>
          )}

        </div>
      </div>

      {showRecommendations && aiModelSettings && (
        <div role="dialog" aria-modal="true" aria-label="Recommended AI models" style={{ position: "fixed", inset: 0, zIndex: 100, display: "grid", placeItems: "center", padding: 20, background: "rgba(3, 9, 12, 0.78)", backdropFilter: "blur(6px)" }} onClick={() => setShowRecommendations(false)}>
          <div className="admin-card" style={{ width: "min(760px, 100%)", maxHeight: "80vh", overflowY: "auto", padding: 28, border: "1px solid rgba(0, 240, 255, 0.3)", boxShadow: "0 20px 70px rgba(0, 0, 0, 0.45)" }} onClick={(event) => event.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "flex-start", marginBottom: 20 }}>
              <div>
                <h2 style={{ fontSize: 19, color: "var(--admin-text)", margin: 0 }}>Recommended models</h2>
                <p style={{ color: "var(--admin-text-muted)", fontSize: 12, margin: "6px 0 0" }}>Curated for accurate, schema-based bank statement extraction. You can still enter any supported model ID.</p>
              </div>
              <button className="admin-btn admin-btn--ghost admin-btn--sm" aria-label="Close" onClick={() => setShowRecommendations(false)}><span className="material-symbols-outlined">close</span></button>
            </div>
            <div style={{ display: "grid", gap: 14 }}>
              {aiModelSettings.providers.map((provider) => (
                <section key={provider.id} style={{ border: "1px solid rgba(255,255,255,0.07)", borderRadius: 10, padding: 16, background: "rgba(255,255,255,0.018)" }}>
                  <h3 style={{ display: "flex", gap: 8, alignItems: "center", color: "var(--admin-text)", fontSize: 14, margin: "0 0 10px" }}><span className="material-symbols-outlined" style={{ color: "var(--admin-cyan)", fontSize: 18 }}>{AI_PROVIDER_ICONS[provider.id]}</span>{provider.label}</h3>
                  <div style={{ display: "grid", gap: 8 }}>
                    {provider.recommendedModels.map((model) => (
                      <div key={model.id} style={{ display: "grid", gridTemplateColumns: "minmax(170px, 0.75fr) 1.25fr", gap: 12, fontSize: 12 }}>
                        <code style={{ color: "var(--admin-cyan)", overflowWrap: "anywhere" }}>{model.id}</code>
                        <span style={{ color: "var(--admin-text-muted)" }}>{model.note}</span>
                      </div>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
