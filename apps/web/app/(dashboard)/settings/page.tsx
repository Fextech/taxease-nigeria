"use client";

import { useSession } from "next-auth/react";
import { useState, useEffect } from "react";

const NIGERIAN_STATES = [
  "Abia","Adamawa","Akwa Ibom","Anambra","Bauchi","Bayelsa","Benue","Borno",
  "Cross River","Delta","Ebonyi","Edo","Ekiti","Enugu","Gombe","Imo","Jigawa",
  "Kaduna","Kano","Katsina","Kebbi","Kogi","Kwara","Lagos","Nasarawa","Niger",
  "Ogun","Ondo","Osun","Oyo","Plateau","Rivers","Sokoto","Taraba","Yobe","Zamfara",
  "FCT (Abuja)",
];

type MfaStep = "idle" | "setup" | "verify" | "disable";
type Tab = "profile" | "security";

export default function SettingsPage() {
  const { data: session, update } = useSession();
  const mfaEnabled = (session as any)?.mfaEnabled ?? false;

  // Tab
  const [activeTab, setActiveTab] = useState<Tab>("profile");

  // Profile state
  const [profileLoading, setProfileLoading] = useState(true);
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileSuccess, setProfileSuccess] = useState("");
  const [profileError, setProfileError] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
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
        </div>

        {/* Profile Tab */}
        {activeTab === "profile" && (
          <div className="settings-card">
            <div className="settings-card-header">
              <span className="material-symbols-outlined settings-card-icon">manage_accounts</span>
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
              <span className="material-symbols-outlined settings-card-icon">shield</span>
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
          </div>
        )}
      </div>

      <style jsx>{`
        .settings-page { display: flex; flex-direction: column; gap: 24px; }

        /* Tabs */
        .settings-tabs {
          display: flex; gap: 4px; padding: 4px; border-radius: 10px;
          background: rgba(35,73,77,0.04); width: fit-content;
        }
        .settings-tab {
          display: flex; align-items: center; gap: 6px; padding: 10px 20px; border-radius: 8px;
          font-size: 14px; font-weight: 600; cursor: pointer; border: none;
          background: transparent; color: var(--te-text-muted); font-family: var(--font-sans);
          transition: all 0.15s;
        }
        .settings-tab:hover { color: var(--te-text); }
        .settings-tab--active {
          background: var(--te-surface); color: var(--te-text);
          box-shadow: 0 1px 3px rgba(0,0,0,0.06);
        }

        /* Card */
        .settings-card {
          background: var(--te-surface); border-radius: 12px; padding: 32px;
          border: 1px solid rgba(35,73,77,0.05); box-shadow: 0 1px 3px rgba(0,0,0,0.04);
        }
        .settings-card-header { display: flex; align-items: center; gap: 16px; margin-bottom: 28px; }
        .settings-card-icon {
          font-size: 24px; color: var(--te-primary);
          width: 48px; height: 48px; border-radius: 12px;
          background: rgba(35,73,77,0.08); display: flex; align-items: center; justify-content: center;
        }
        .settings-card-title { font-size: 20px; font-weight: 700; color: var(--te-text); margin: 0; }
        .settings-card-desc { font-size: 13px; color: var(--te-text-muted); margin: 4px 0 0; }

        /* Alerts */
        .settings-alert {
          display: flex; align-items: center; gap: 8px; padding: 12px 16px;
          border-radius: 8px; margin-bottom: 20px; font-size: 13px; font-weight: 500;
        }
        .settings-alert--success { background: rgba(16,185,129,0.08); color: #059669; border: 1px solid rgba(16,185,129,0.15); }
        .settings-alert--error { background: rgba(239,68,68,0.08); color: #dc2626; border: 1px solid rgba(239,68,68,0.15); }

        /* Loading */
        .settings-loading { text-align: center; padding: 40px 0; color: var(--te-text-muted); }
        .settings-loading p { margin: 12px 0 0; font-size: 14px; }
        .settings-spin { animation: spin 1.5s linear infinite; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }

        /* Form */
        .settings-form { display: flex; flex-direction: column; gap: 20px; }
        .settings-field { display: flex; flex-direction: column; gap: 6px; }
        .settings-label { font-size: 13px; font-weight: 600; color: var(--te-text-secondary); }
        .settings-input {
          padding: 12px 16px; border-radius: 8px; border: 1px solid var(--te-border);
          background: var(--te-surface); font-size: 14px; color: var(--te-text);
          font-family: var(--font-sans); outline: none; transition: border-color 0.15s;
        }
        .settings-input:focus { border-color: var(--te-primary); }
        .settings-select {
          padding: 12px 16px; border-radius: 8px; border: 1px solid var(--te-border);
          background: var(--te-surface); font-size: 14px; color: var(--te-text);
          font-family: var(--font-sans); outline: none; cursor: pointer;
        }
        .settings-select:focus { border-color: var(--te-primary); }
        .settings-hint { font-size: 11px; color: var(--te-text-muted); margin: 0; }

        /* Actions */
        .settings-actions { display: flex; gap: 12px; justify-content: flex-end; padding-top: 8px; }
        .settings-btn-primary {
          padding: 12px 28px; border-radius: 8px; font-size: 14px; font-weight: 600;
          border: none; background: var(--te-primary); color: #fff;
          cursor: pointer; font-family: var(--font-sans); transition: all 0.15s;
        }
        .settings-btn-primary:hover:not(:disabled) { background: var(--te-primary-light); }
        .settings-btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }
        .settings-btn-danger {
          padding: 12px 24px; border-radius: 8px; font-size: 14px; font-weight: 600;
          background: rgba(239,68,68,0.08); color: #dc2626; border: 1px solid rgba(239,68,68,0.15);
          cursor: pointer; font-family: var(--font-sans); transition: all 0.15s;
        }
        .settings-btn-danger:hover:not(:disabled) { background: rgba(239,68,68,0.15); }
        .settings-btn-danger:disabled { opacity: 0.6; cursor: not-allowed; }
        .settings-btn-ghost {
          padding: 12px 24px; border-radius: 8px; font-size: 14px; font-weight: 600;
          background: transparent; color: var(--te-text-secondary); border: 1px solid var(--te-border);
          cursor: pointer; font-family: var(--font-sans); transition: all 0.15s;
        }
        .settings-btn-ghost:hover { background: var(--te-surface-hover); }

        /* MFA Section */
        .sec-mfa-row { display: flex; align-items: center; justify-content: space-between; gap: 16px; margin-bottom: 20px; }
        .sec-mfa-label { font-size: 16px; font-weight: 600; color: var(--te-text); margin: 0; }
        .sec-mfa-desc { font-size: 13px; color: var(--te-text-muted); margin: 4px 0 0; }
        .sec-badge {
          font-size: 12px; font-weight: 600; padding: 4px 12px;
          border-radius: 20px; white-space: nowrap;
        }
        .sec-badge-on { background: rgba(16,185,129,0.1); color: #059669; border: 1px solid rgba(16,185,129,0.2); }
        .sec-badge-off { background: rgba(100,116,139,0.06); color: var(--te-text-muted); border: 1px solid var(--te-border); }

        .sec-setup {}
        .sec-setup-text { font-size: 14px; color: var(--te-text-muted); line-height: 1.6; margin-bottom: 24px; }
        .sec-qr-container {
          display: flex; justify-content: center; margin-bottom: 20px;
          background: #fff; border-radius: 12px; padding: 16px;
          width: fit-content; margin-left: auto; margin-right: auto;
          border: 1px solid var(--te-border);
        }
        .sec-qr { width: 180px; height: 180px; }
        .sec-manual { text-align: center; margin-bottom: 24px; }
        .sec-manual-label { font-size: 12px; color: var(--te-text-muted); margin-bottom: 8px; }
        .sec-manual-code {
          display: inline-block; padding: 8px 16px; border-radius: 8px;
          background: rgba(35,73,77,0.04); border: 1px solid var(--te-border);
          color: var(--te-primary); font-size: 14px; letter-spacing: 2px;
          font-family: monospace; user-select: all;
        }
        .sec-code-input {
          text-align: center !important; letter-spacing: 8px; font-size: 18px !important;
          font-family: monospace !important;
        }

        @media (max-width: 768px) {
          .settings-card { padding: 24px 16px; }
          .sec-mfa-row { flex-direction: column; align-items: flex-start; }
          .settings-actions { flex-direction: column; }
          .settings-btn-primary, .settings-btn-danger, .settings-btn-ghost { width: 100%; text-align: center; }
        }
      `}</style>
    </>
  );
}
