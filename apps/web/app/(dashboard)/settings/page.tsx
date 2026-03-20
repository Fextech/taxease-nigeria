"use client";

import { useSession } from "next-auth/react";
import { useState, useEffect } from "react";
import { useWorkspace } from "@/components/dashboard/WorkspaceContext";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";

const NIGERIAN_STATES = [
  "Abia", "Adamawa", "Akwa Ibom", "Anambra", "Bauchi", "Bayelsa", "Benue", "Borno",
  "Cross River", "Delta", "Ebonyi", "Edo", "Ekiti", "Enugu", "Gombe", "Imo", "Jigawa",
  "Kaduna", "Kano", "Katsina", "Kebbi", "Kogi", "Kwara", "Lagos", "Nasarawa", "Niger",
  "Ogun", "Ondo", "Osun", "Oyo", "Plateau", "Rivers", "Sokoto", "Taraba", "Yobe", "Zamfara",
  "FCT (Abuja)",
];

type MfaStep = "idle" | "setup" | "verify" | "disable";
type Tab = "profile" | "security" | "billing";

export default function SettingsPage() {
  return (
    <Suspense fallback={<div style={{ padding: 24 }}>Loading settings...</div>}>
      <SettingsContent />
    </Suspense>
  );
}

function SettingsContent() {
  const { data: session, update } = useSession();
  const mfaEnabled = (session as unknown as { mfaEnabled: boolean })?.mfaEnabled ?? false;
  const { activeWorkspace, refresh: refreshWorkspace } = useWorkspace();
  const router = useRouter();
  const searchParams = useSearchParams();

  // Tab
  const initialTab = (searchParams.get("tab") as Tab) || "profile";
  const [activeTab, setActiveTab] = useState<Tab>(initialTab);

  // Profile state
  const [profileLoading, setProfileLoading] = useState(true);
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileSuccess, setProfileSuccess] = useState("");
  const [profileError, setProfileError] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [taxIdentificationNumber, setTaxIdentificationNumber] = useState("");
  const [professionalCategory, setProfessionalCategory] = useState("");
  const [stateOfResidence, setStateOfResidence] = useState("");

  // MFA state
  const [step, setStep] = useState<MfaStep>("idle");
  const [qrCode, setQrCode] = useState("");
  const [manualSecret, setManualSecret] = useState("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Change Password state
  const [cpCurrent, setCpCurrent] = useState("");
  const [cpNew, setCpNew] = useState("");
  const [cpConfirm, setCpConfirm] = useState("");
  const [showCpCurrent, setShowCpCurrent] = useState(false);
  const [showCpNew, setShowCpNew] = useState(false);
  const [cpLoading, setCpLoading] = useState(false);
  const [cpError, setCpError] = useState("");
  const [cpSuccess, setCpSuccess] = useState("");

  // Billing state
  const [billingLoading, setBillingLoading] = useState(false);
  const [billingStatus, setBillingStatus] = useState({ type: "", message: "" });
  const [buyCreditAmount, setBuyCreditAmount] = useState<number>(2);
  const [pricingConfig, setPricingConfig] = useState<{
    workspaceUnlockKobo: number;
    creditPriceKobo: number;
    bankAccountAddonKobo: number;
    standardCredits: number;
  } | null>(null);

  // Load pricing
  useEffect(() => {
    fetch("/api/billing")
      .then(res => res.json())
      .then(data => {
        if (!data.error) setPricingConfig(data);
      })
      .catch(() => { });
  }, []);

  // Handle Paystack callback redirect
  useEffect(() => {
    const reference = searchParams.get("reference");
    if (reference && activeWorkspace) {
      setBillingStatus({ type: "info", message: "Verifying your payment..." });
      setActiveTab("billing");
      setBillingLoading(true);

      fetch("/api/billing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "verifyPayment", reference }),
      })
        .then(async (res) => {
          const data = await res.json();
          if (res.ok) {
            setBillingStatus({ type: "success", message: "Payment verified successfully!" });
            await refreshWorkspace();
            // Clear query params
            router.replace("/settings");
          } else {
            setBillingStatus({ type: "error", message: data.error || "Payment verification failed." });
          }
        })
        .catch(() => setBillingStatus({ type: "error", message: "Payment verification failed." }))
        .finally(() => setBillingLoading(false));
    }
  }, [searchParams, activeWorkspace, router, refreshWorkspace]);

  // Billing Handlers
  const handleUnlock = async () => {
    if (!activeWorkspace) return;
    setBillingLoading(true);
    setBillingStatus({ type: "", message: "" });
    try {
      const res = await fetch("/api/billing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "unlockWorkspace",
          workspaceId: activeWorkspace.id,
          callbackUrl: window.location.origin + "/settings",
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to initialize checkout");
      window.location.href = data.authorizationUrl;
    } catch (err: unknown) {
      setBillingStatus({ type: "error", message: (err as Error).message || "Failed to initialize checkout" });
      setBillingLoading(false);
    }
  };

  const handleBuyCredits = async () => {
    if (!activeWorkspace) return;
    setBillingLoading(true);
    setBillingStatus({ type: "", message: "" });
    try {
      const res = await fetch("/api/billing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "purchaseCredits",
          workspaceId: activeWorkspace.id,
          credits: buyCreditAmount,
          callbackUrl: window.location.origin + "/settings",
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to initialize checkout");
      window.location.href = data.authorizationUrl;
    } catch (err: unknown) {
      setBillingStatus({ type: "error", message: (err as Error).message || "Failed to initialize checkout" });
      setBillingLoading(false);
    }
  };

  const handleAddBank = async () => {
    if (!activeWorkspace) return;
    setBillingLoading(true);
    setBillingStatus({ type: "", message: "" });
    try {
      const res = await fetch("/api/billing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "addBankAccount",
          workspaceId: activeWorkspace.id,
          callbackUrl: window.location.origin + "/settings",
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to initialize checkout");
      window.location.href = data.authorizationUrl;
    } catch (err: unknown) {
      setBillingStatus({ type: "error", message: (err as Error).message || "Failed to initialize checkout" });
      setBillingLoading(false);
    }
  };

  // Load profile
  useEffect(() => {
    async function loadProfile() {
      try {
        const res = await fetch("/api/settings", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "get" }),
        });
        if (res.ok) {
          const data = await res.json();
          setName(data.name || "");
          setEmail(data.email || "");
          setPhone(data.phone || "");
          setTaxIdentificationNumber(data.taxIdentificationNumber || "");
          setProfessionalCategory(data.professionalCategory || "");
          setStateOfResidence(data.stateOfResidence || "");
        }
      } catch { /* silent */ }
      setProfileLoading(false);
    }
    loadProfile();
  }, []);

  const handleSaveProfile = async () => {
    setProfileSaving(true);
    setProfileError("");
    setProfileSuccess("");
    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update",
          name,
          phone,
          taxIdentificationNumber,
          professionalCategory,
          stateOfResidence,
        }),
      });
      if (res.ok) {
        setProfileSuccess("Settings saved successfully!");
        setTimeout(() => setProfileSuccess(""), 3000);
      } else {
        const data = await res.json();
        setProfileError(data.error || "Failed to save settings");
      }
    } catch {
      setProfileError("Something went wrong.");
    }
    setProfileSaving(false);
  };

  // MFA handlers
  const handleSetup = async () => {
    setError(""); setLoading(true);
    try {
      const res = await fetch("/api/mfa/setup", { method: "POST" });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Failed to start MFA setup"); return; }
      setQrCode(data.qrCode); setManualSecret(data.secret); setStep("setup");
    } catch { setError("Something went wrong."); }
    finally { setLoading(false); }
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (code.length !== 6) { setError("Enter 6 digits"); return; }
    setError(""); setLoading(true);
    try {
      const res = await fetch("/api/mfa/verify", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Invalid code"); return; }
      await update({ mfaVerified: true });
      setSuccess("Two-factor authentication enabled successfully!");
      setStep("idle"); setCode("");
    } catch { setError("Something went wrong."); }
    finally { setLoading(false); }
  };

  const handleDisable = async (e: React.FormEvent) => {
    e.preventDefault();
    if (code.length !== 6) { setError("Enter 6 digits"); return; }
    setError(""); setLoading(true);
    try {
      const res = await fetch("/api/mfa/disable", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Invalid code"); return; }
      await update({ mfaVerified: false });
      setSuccess("Two-factor authentication has been disabled.");
      setStep("idle"); setCode("");
    } catch { setError("Something went wrong."); }
    finally { setLoading(false); }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setCpError(""); setCpSuccess("");
    if (cpNew !== cpConfirm) { setCpError("New passwords do not match."); return; }
    if (cpNew.length < 8) { setCpError("New password must be at least 8 characters."); return; }

    setCpLoading(true);
    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "change_password",
          currentPassword: cpCurrent,
          newPassword: cpNew,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setCpError(data.error || "Failed to change password"); return; }

      setCpSuccess("Password changed successfully!");
      setCpCurrent(""); setCpNew(""); setCpConfirm("");
      setTimeout(() => setCpSuccess(""), 4000);
    } catch { setCpError("Something went wrong."); }
    finally { setCpLoading(false); }
  };

  return (
    <>
      <div className="settings-page">
        {/* Tabs */}
        <div className="settings-tabs">
          <button className={`settings-tab ${activeTab === "profile" ? "settings-tab--active" : ""}`} onClick={() => setActiveTab("profile")}>
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>person</span>
            Profile
          </button>
          <button className={`settings-tab ${activeTab === "security" ? "settings-tab--active" : ""}`} onClick={() => setActiveTab("security")}>
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>shield</span>
            Security
          </button>
          <button className={`settings-tab ${activeTab === "billing" ? "settings-tab--active" : ""}`} onClick={() => setActiveTab("billing")}>
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>credit_card</span>
            Billing
          </button>
        </div>

        {/* Profile Tab */}
        {activeTab === "profile" && (
          <div className="settings-card">
            <div className="settings-card-header">
              <div className="settings-card-icon">
                <span className="material-symbols-outlined" style={{ fontSize: 24 }}>manage_accounts</span>
              </div>
              <div>
                <h2 className="settings-card-title">Account Settings</h2>
                <p className="settings-card-desc">Manage your personal information and preferences</p>
              </div>
            </div>

            {profileSuccess && (
              <div className="settings-alert settings-alert--success">
                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>check_circle</span>
                {profileSuccess}
              </div>
            )}
            {profileError && (
              <div className="settings-alert settings-alert--error">
                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>error</span>
                {profileError}
              </div>
            )}

            {profileLoading ? (
              <div className="settings-loading">
                <span className="material-symbols-outlined settings-spin" style={{ fontSize: 24, color: "var(--te-primary)" }}>sync</span>
                <p>Loading settings...</p>
              </div>
            ) : (
              <div className="settings-form">
                <div className="settings-field">
                  <label className="settings-label">Full Name</label>
                  <input className="settings-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Your full name" />
                </div>
                <div className="settings-field">
                  <label className="settings-label">Email Address</label>
                  <input className="settings-input" value={email} disabled style={{ opacity: 0.6 }} />
                  <p className="settings-hint">Email cannot be changed</p>
                </div>
                <div className="settings-field">
                  <label className="settings-label">Phone Number</label>
                  <input className="settings-input" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+234..." />
                </div>
                <div className="settings-field">
                  <label className="settings-label">Tax Identification Number (TIN)</label>
                  <input className="settings-input" value={taxIdentificationNumber} onChange={(e) => setTaxIdentificationNumber(e.target.value)} placeholder="e.g. 12345678-0001" />
                </div>
                <div className="settings-field">
                  <label className="settings-label">Professional Category</label>
                  <select className="settings-select" value={professionalCategory} onChange={(e) => setProfessionalCategory(e.target.value)}>
                    <option value="">Select category</option>
                    <option value="EMPLOYEE">Employee</option>
                    <option value="SELF_EMPLOYED">Self-Employed</option>
                    <option value="FREELANCER">Freelancer / Contractor</option>
                    <option value="BUSINESS_OWNER">Business Owner</option>
                    <option value="OTHER">Other</option>
                  </select>
                </div>
                <div className="settings-field">
                  <label className="settings-label">State of Residence</label>
                  <select className="settings-select" value={stateOfResidence} onChange={(e) => setStateOfResidence(e.target.value)}>
                    <option value="">Select your state</option>
                    {NIGERIAN_STATES.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                  <p className="settings-hint">Used to direct you to the correct state IRS portal</p>
                </div>
                <div className="settings-actions">
                  <button className="settings-btn-primary" onClick={handleSaveProfile} disabled={profileSaving}>
                    {profileSaving ? "Saving..." : "Save Changes"}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Security Tab */}
        {activeTab === "security" && (
          <div className="settings-card">
            <div className="settings-card-header">
              <div className="settings-card-icon">
                <span className="material-symbols-outlined" style={{ fontSize: 24 }}>shield</span>
              </div>
              <div>
                <h2 className="settings-card-title">Security Settings</h2>
                <p className="settings-card-desc">Manage your account security preferences</p>
              </div>
            </div>

            {/* Status Messages */}
            {success && (
              <div className="settings-alert settings-alert--success">
                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>check_circle</span>
                {success}
              </div>
            )}
            {error && (
              <div className="settings-alert settings-alert--error">
                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>error</span>
                {error}
              </div>
            )}

            {/* Idle State */}
            {step === "idle" && (
              <div className="sec-mfa-status">
                <div className="sec-mfa-row">
                  <div>
                    <h3 className="sec-mfa-label">Two-Factor Authentication</h3>
                    <p className="sec-mfa-desc">Add an extra layer of security using an authenticator app</p>
                  </div>
                  <span className={`sec-badge ${mfaEnabled ? "sec-badge-on" : "sec-badge-off"}`}>
                    {mfaEnabled ? "Enabled" : "Disabled"}
                  </span>
                </div>
                {mfaEnabled ? (
                  <button className="settings-btn-danger" onClick={() => { setStep("disable"); setCode(""); setError(""); setSuccess(""); }}>
                    Disable 2FA
                  </button>
                ) : (
                  <button className="settings-btn-primary" onClick={handleSetup} disabled={loading}>
                    {loading ? "Setting up..." : "Enable 2FA"}
                  </button>
                )}
              </div>
            )}

            {/* Setup Step: Show QR Code */}
            {step === "setup" && (
              <form onSubmit={handleVerify} className="sec-setup">
                <p className="sec-setup-text">
                  Scan the QR code below with your authenticator app, then enter the 6-digit code to verify.
                </p>
                <div className="sec-qr-container">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={qrCode} alt="QR Code" className="sec-qr" />
                </div>
                <div className="sec-manual">
                  <p className="sec-manual-label">Or enter this code manually:</p>
                  <code className="sec-manual-code">{manualSecret}</code>
                </div>
                <div className="settings-field">
                  <label htmlFor="verify-code" className="settings-label">Verification Code</label>
                  <input
                    id="verify-code"
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                    placeholder="000000"
                    className="settings-input sec-code-input"
                    autoComplete="one-time-code"
                  />
                </div>
                <div className="settings-actions">
                  <button type="button" className="settings-btn-ghost" onClick={() => { setStep("idle"); setError(""); }}>Cancel</button>
                  <button type="submit" className="settings-btn-primary" disabled={loading}>
                    {loading ? "Verifying..." : "Verify & Enable"}
                  </button>
                </div>
              </form>
            )}

            {/* Disable Step */}
            {step === "disable" && (
              <form onSubmit={handleDisable} className="sec-setup">
                <p className="sec-setup-text">
                  Enter your current 6-digit authenticator code to disable two-factor authentication.
                </p>
                <div className="settings-field">
                  <label htmlFor="disable-code" className="settings-label">Authenticator Code</label>
                  <input
                    id="disable-code"
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                    placeholder="000000"
                    className="settings-input sec-code-input"
                    autoComplete="one-time-code"
                  />
                </div>
                <div className="settings-actions">
                  <button type="button" className="settings-btn-ghost" onClick={() => { setStep("idle"); setError(""); }}>Cancel</button>
                  <button type="submit" className="settings-btn-danger" disabled={loading}>
                    {loading ? "Disabling..." : "Disable 2FA"}
                  </button>
                </div>
              </form>
            )}

            {/* Change Password Section */}
            <div className="settings-section-divider" style={{ borderTop: "1px solid var(--te-border)", margin: "32px 0", paddingTop: "32px" }}>
              <div className="settings-card-header" style={{ borderBottom: "none", paddingBottom: "16px", paddingLeft: "0", paddingRight: "0", paddingTop: "0" }}>
                <div>
                  <h3 className="sec-mfa-label" style={{ marginBottom: "4px" }}>Change Password</h3>
                  <p className="sec-mfa-desc">Update your account login password</p>
                </div>
              </div>

              {cpSuccess && (
                <div className="settings-alert settings-alert--success" style={{ marginBottom: "20px" }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 16 }}>check_circle</span>
                  {cpSuccess}
                </div>
              )}
              {cpError && (
                <div className="settings-alert settings-alert--error" style={{ marginBottom: "20px" }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 16 }}>error</span>
                  {cpError}
                </div>
              )}

              <form onSubmit={handleChangePassword} className="settings-form" style={{ maxWidth: "500px" }}>
                <div className="settings-field">
                  <label className="settings-label">Current Password</label>
                  <div className="relative flex items-center">
                    <input
                      type={showCpCurrent ? "text" : "password"}
                      value={cpCurrent}
                      onChange={(e) => setCpCurrent(e.target.value)}
                      placeholder="••••••••"
                      className="settings-input w-full"
                      required
                      style={{ paddingRight: "40px" }}
                    />
                    <button
                      type="button"
                      className="absolute right-3 text-slate-400 hover:text-white transition-colors flex items-center justify-center h-full"
                      onClick={() => setShowCpCurrent(!showCpCurrent)}
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
                        {showCpCurrent ? "visibility_off" : "visibility"}
                      </span>
                    </button>
                  </div>
                </div>

                <div className="settings-field">
                  <label className="settings-label">New Password</label>
                  <div className="relative flex items-center">
                    <input
                      type={showCpNew ? "text" : "password"}
                      value={cpNew}
                      onChange={(e) => setCpNew(e.target.value)}
                      placeholder="••••••••"
                      className="settings-input w-full"
                      required
                      minLength={8}
                      style={{ paddingRight: "40px" }}
                    />
                    <button
                      type="button"
                      className="absolute right-3 text-slate-400 hover:text-white transition-colors flex items-center justify-center h-full"
                      onClick={() => setShowCpNew(!showCpNew)}
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
                        {showCpNew ? "visibility_off" : "visibility"}
                      </span>
                    </button>
                  </div>
                  <p className="settings-hint">Min 8 characters, with uppercase, lowercase, and a number</p>
                </div>

                <div className="settings-field">
                  <label className="settings-label">Confirm New Password</label>
                  <div className="relative flex items-center">
                    <input
                      type={showCpNew ? "text" : "password"}
                      value={cpConfirm}
                      onChange={(e) => setCpConfirm(e.target.value)}
                      placeholder="••••••••"
                      className="settings-input w-full"
                      required
                      minLength={8}
                      style={{ paddingRight: "40px" }}
                    />
                  </div>
                </div>

                <div className="settings-actions" style={{ justifyContent: "flex-start", marginTop: "8px" }}>
                  <button type="submit" className="settings-btn-primary" disabled={cpLoading}>
                    {cpLoading ? "Updating..." : "Update Password"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Billing Tab */}
        {activeTab === "billing" && (
          <div className="settings-card">
            <div className="settings-card-header">
              <div className="settings-card-icon" style={{ background: "rgba(16,185,129,0.1)", color: "var(--te-mint)" }}>
                <span className="material-symbols-outlined" style={{ fontSize: 24 }}>credit_card</span>
              </div>
              <div>
                <h2 className="settings-card-title">Billing & Credits</h2>
                <p className="settings-card-desc">Manage your workspace subscription and statement credits</p>
              </div>
            </div>

            {billingStatus.message && (
              <div className={`settings-alert settings-alert--${billingStatus.type === "error" ? "error" : "success"}`}>
                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
                  {billingStatus.type === "error" ? "error" : "check_circle"}
                </span>
                {billingStatus.message}
              </div>
            )}

            {activeWorkspace ? (
              <div className="billing-grid">
                {/* Plan Card */}
                <div className="billing-item-card">
                  <div className="billing-item-header">
                    <div>
                      <h3 className="billing-item-title">Current Plan</h3>
                      <p className="billing-item-desc">Tax Year {activeWorkspace.taxYear}</p>
                    </div>
                    <span className={`sec-badge ${activeWorkspace.isUnlocked ? "sec-badge-on" : "sec-badge-off"}`}>
                      {activeWorkspace.isUnlocked ? "Standard (Unlocked)" : "Free Tier"}
                    </span>
                  </div>
                  <div className="billing-item-body">
                    {!activeWorkspace.isUnlocked && !activeWorkspace.unlockMethod && (
                      <p className="billing-text">You are currently on the free tier. Only months 1-3 (Jan-Mar) are unlocked for this workspace.</p>
                    )}
                    {!activeWorkspace.isUnlocked && activeWorkspace.unlockMethod === 'CREDIT' && (
                      <p className="billing-text">You are unlocking months individually with credits. {((activeWorkspace.unlockedMonths as number[] | undefined) ?? []).length} of 9 extra months unlocked so far.</p>
                    )}
                    {activeWorkspace.isUnlocked && (
                      <p className="billing-text">You have full access to all 12 months for this workspace.</p>
                    )}
                  </div>
                  {!activeWorkspace.isUnlocked && activeWorkspace.unlockMethod !== 'CREDIT' && (
                    <div className="billing-item-footer">
                      <button className="settings-btn-primary" style={{ width: "100%" }} onClick={handleUnlock} disabled={billingLoading || !pricingConfig}>
                        {billingLoading ? "Processing..." : `Unlock Full Year — ₦${(pricingConfig ? pricingConfig.workspaceUnlockKobo / 100 : 5000).toLocaleString()}`}
                      </button>
                    </div>
                  )}
                </div>

                {/* Credits Card — hidden if user chose FULL year unlock */}
                {activeWorkspace.unlockMethod !== 'FULL' && (() => {
                  const alreadyUnlocked = ((activeWorkspace.unlockedMonths as number[] | undefined) ?? []).length;
                  const currentCredits = activeWorkspace.statementCredits ?? 0;
                  const maxPurchasable = Math.max(0, 9 - alreadyUnlocked - currentCredits);

                  return (
                  <div className="billing-item-card">
                    <div className="billing-item-header">
                      <div>
                        <h3 className="billing-item-title">Unlock Credits</h3>
                        <p className="billing-item-desc">Used for unlocking individual months</p>
                      </div>
                      <div className="billing-credit-badge">
                        <span className="material-symbols-outlined" style={{ fontSize: 16 }}>local_activity</span>
                        <strong>{currentCredits}</strong> left
                      </div>
                    </div>
                    <div className="billing-item-body">
                      <p className="billing-text" style={{ marginBottom: 16 }}>Each credit unlocks 1 additional month for statement uploads. You can purchase up to {maxPurchasable} more credit{maxPurchasable !== 1 ? 's' : ''}.</p>
                      {maxPurchasable > 0 ? (
                      <div className="billing-credit-selector">
                        <button
                          className="credit-adjust-btn"
                          onClick={() => setBuyCreditAmount(Math.max(1, buyCreditAmount - 1))}
                          disabled={billingLoading || buyCreditAmount <= 1}
                        >
                          <span className="material-symbols-outlined" style={{ fontSize: 16 }}>remove</span>
                        </button>
                        <input
                          type="number"
                          className="settings-input credit-input"
                          value={buyCreditAmount}
                          onChange={(e) => setBuyCreditAmount(Math.max(1, Math.min(maxPurchasable, parseInt(e.target.value) || 1)))}
                          min={1}
                          max={maxPurchasable}
                          step={1}
                          disabled={billingLoading}
                        />
                        <button
                          className="credit-adjust-btn"
                          onClick={() => setBuyCreditAmount(Math.min(maxPurchasable, buyCreditAmount + 1))}
                          disabled={billingLoading || buyCreditAmount >= maxPurchasable}
                        >
                          <span className="material-symbols-outlined" style={{ fontSize: 16 }}>add</span>
                        </button>
                      </div>
                      ) : (
                        <p className="billing-text" style={{ color: "var(--te-mint)", fontWeight: 600 }}>All 9 months are covered (unlocked + credits on hand).</p>
                      )}
                    </div>
                    {maxPurchasable > 0 && (
                    <div className="billing-item-footer">
                      <button className="settings-btn-ghost" style={{ width: "100%" }} onClick={handleBuyCredits} disabled={billingLoading || !pricingConfig}>
                        Buy {buyCreditAmount} Credits — ₦{pricingConfig ? (buyCreditAmount * (pricingConfig.creditPriceKobo / 100)).toLocaleString() : (buyCreditAmount * 250).toLocaleString()}
                      </button>
                    </div>
                    )}
                  </div>
                  );
                })()}

                {/* Banks Card */}
                <div className="billing-item-card">
                  <div className="billing-item-header">
                    <div>
                      <h3 className="billing-item-title">Allowed Bank Accounts</h3>
                      <p className="billing-item-desc">Number of unique bank accounts you can process</p>
                    </div>
                    <div className="billing-credit-badge" style={{ background: "rgba(35,73,77,0.06)", color: "var(--te-primary)", borderColor: "var(--te-border)" }}>
                      <span className="material-symbols-outlined" style={{ fontSize: 16 }}>account_balance</span>
                      <strong>{activeWorkspace.allowedBanksCount ?? 1}</strong> accounts
                    </div>
                  </div>
                  <div className="billing-item-body">
                    <p className="billing-text">Need to file statements from multiple banks? Add more bank capacity to this workspace.</p>
                  </div>
                  <div className="billing-item-footer">
                    <button className="settings-btn-ghost" style={{ width: "100%" }} onClick={handleAddBank} disabled={billingLoading || !pricingConfig}>
                      Add Bank Account — ₦{pricingConfig ? (pricingConfig.bankAccountAddonKobo / 100).toLocaleString() : "3,000"}
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <p className="settings-hint">Loading workspace data...</p>
            )}
          </div>
        )}
      </div>

    </>
  );
}
