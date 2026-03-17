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
    </div>
  );
}



export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: "100vh", background: "#1a3639" }} />}>
      <ResetPasswordContent />
    </Suspense>
  );
}
