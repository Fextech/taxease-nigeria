"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";

function ResetPasswordContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  if (!token) {
    return (
      <div className="rp-page">
        <div className="rp-card">
          <div className="rp-header">
            <h1 className="rp-title">Invalid Reset Link</h1>
            <p className="rp-subtitle">This password reset link is invalid or has expired.</p>
          </div>
          <a href="/forgot-password" className="rp-link">Request a new reset link</a>
        </div>
        <div className="rp-bg-pattern" />
        <style jsx>{styles}</style>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Something went wrong");
        return;
      }

      setSuccess(true);
      setTimeout(() => router.push("/sign-in"), 3000);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rp-page">
      <div className="rp-card">
        <div className="rp-header">
          <div className="rp-icon">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <rect x="3" y="11" width="18" height="11" rx="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              <circle cx="12" cy="16" r="1" />
            </svg>
          </div>
          <h1 className="rp-title">{success ? "Password Reset!" : "Set a new password"}</h1>
          <p className="rp-subtitle">
            {success
              ? "Redirecting you to sign in..."
              : "Choose a strong password for your account"}
          </p>
        </div>

        {error && (
          <div className="rp-error">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5" />
              <path d="M8 4.5v4M8 10.5v.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            <span>{error}</span>
          </div>
        )}

        {success ? (
          <div className="rp-success">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5" />
              <path d="M5 8l2 2 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span>Your password has been reset. Redirecting to sign in...</span>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="rp-form">
            <div className="rp-field">
              <label htmlFor="password" className="rp-label">New Password</label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="rp-input"
                required
                minLength={8}
                autoComplete="new-password"
              />
              <span className="rp-hint">Min 8 characters, with uppercase, lowercase, and a number</span>
            </div>
            <div className="rp-field">
              <label htmlFor="confirmPassword" className="rp-label">Confirm Password</label>
              <input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                className="rp-input"
                required
                minLength={8}
                autoComplete="new-password"
              />
            </div>
            <button type="submit" className="rp-submit-btn" disabled={loading}>
              {loading ? "Resetting..." : "Reset password"}
            </button>
          </form>
        )}
      </div>

      <div className="rp-bg-pattern" />
      <style jsx>{styles}</style>
    </div>
  );
}

const styles = `
  .rp-page {
    min-height: 100vh; display: flex; align-items: center; justify-content: center;
    background: linear-gradient(135deg, #1a3639 0%, #23494d 40%, #1a2e3a 100%);
    padding: 24px; position: relative; overflow: hidden;
  }
  .rp-bg-pattern {
    position: absolute; inset: 0; pointer-events: none;
    background-image:
      radial-gradient(circle at 20% 80%, rgba(240, 160, 48, 0.08) 0%, transparent 50%),
      radial-gradient(circle at 80% 20%, rgba(45, 94, 99, 0.15) 0%, transparent 50%);
  }
  .rp-card {
    position: relative; z-index: 1; width: 100%; max-width: 420px;
    background: rgba(255, 255, 255, 0.04); backdrop-filter: blur(24px);
    border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 20px;
    padding: 48px 40px;
    box-shadow: 0 24px 48px rgba(0, 0, 0, 0.3), 0 0 0 1px rgba(255, 255, 255, 0.05) inset;
  }
  .rp-header { text-align: center; margin-bottom: 32px; }
  .rp-icon {
    width: 64px; height: 64px; border-radius: 16px;
    background: linear-gradient(135deg, #23494d, #2d5e63);
    display: flex; align-items: center; justify-content: center;
    margin: 0 auto 20px; color: #f0a030;
  }
  .rp-title { font-size: 24px; font-weight: 700; color: #fff; margin-bottom: 8px; }
  .rp-subtitle { font-size: 14px; color: rgba(255,255,255,0.5); }
  .rp-error {
    display: flex; align-items: center; gap: 10px;
    padding: 12px 16px; border-radius: 10px; margin-bottom: 24px;
    background: rgba(239, 68, 68, 0.12); border: 1px solid rgba(239, 68, 68, 0.2);
    color: #fca5a5; font-size: 13px;
  }
  .rp-success {
    display: flex; align-items: center; gap: 10px; justify-content: center;
    padding: 12px 16px; border-radius: 10px;
    background: rgba(34, 197, 94, 0.12); border: 1px solid rgba(34, 197, 94, 0.2);
    color: #86efac; font-size: 13px;
  }
  .rp-form { display: flex; flex-direction: column; gap: 16px; }
  .rp-field { display: flex; flex-direction: column; gap: 6px; }
  .rp-label { font-size: 13px; font-weight: 500; color: rgba(255,255,255,0.6); }
  .rp-input {
    width: 100%; padding: 12px 16px; border-radius: 10px;
    background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1);
    color: #fff; font-size: 14px; outline: none; transition: all 0.2s;
    font-family: var(--font-sans), system-ui, sans-serif;
  }
  .rp-input::placeholder { color: rgba(255,255,255,0.25); }
  .rp-input:focus { border-color: rgba(240, 160, 48, 0.5); box-shadow: 0 0 0 3px rgba(240, 160, 48, 0.1); }
  .rp-hint { font-size: 11px; color: rgba(255,255,255,0.3); }
  .rp-submit-btn {
    width: 100%; padding: 14px 24px; border-radius: 12px;
    background: linear-gradient(135deg, #f0a030, #e8912a); color: #fff;
    font-size: 15px; font-weight: 600; border: none; cursor: pointer;
    transition: all 0.2s; font-family: var(--font-sans), system-ui, sans-serif;
    box-shadow: 0 4px 16px rgba(240, 160, 48, 0.25); margin-top: 4px;
  }
  .rp-submit-btn:hover:not(:disabled) { transform: translateY(-1px); }
  .rp-submit-btn:disabled { opacity: 0.6; cursor: not-allowed; }
  .rp-link {
    display: block; text-align: center; font-size: 14px;
    color: #f0a030; text-decoration: none; margin-top: 16px;
  }
  @media (max-width: 480px) { .rp-card { padding: 36px 24px; } }
`;

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: "100vh", background: "#1a3639" }} />}>
      <ResetPasswordContent />
    </Suspense>
  );
}
