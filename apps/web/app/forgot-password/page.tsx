"use client";

import { useState } from "react";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Something went wrong");
        return;
      }

      setSent(true);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fp-page">
      <div className="fp-card">
        <div className="fp-header">
          <div className="fp-icon">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <rect x="3" y="11" width="18" height="11" rx="2" />
              <path d="M7 11V7a5 5 0 0 1 9.9-1" />
            </svg>
          </div>
          <h1 className="fp-title">Forgot your password?</h1>
          <p className="fp-subtitle">
            {sent
              ? "Check your email for a reset link"
              : "Enter your email and we'll send you a reset link"}
          </p>
        </div>

        {error && (
          <div className="fp-error">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5" />
              <path d="M8 4.5v4M8 10.5v.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            <span>{error}</span>
          </div>
        )}

        {sent ? (
          <div className="fp-sent">
            <div className="fp-sent-icon">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M22 6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v12c0 1.1.9 2 2 2h16a2 2 0 0 0 2-2V6z" />
                <path d="M22 6l-10 7L2 6" />
              </svg>
            </div>
            <p className="fp-sent-text">
              If an account exists with <strong>{email}</strong>, you&apos;ll receive an email with a reset link shortly.
            </p>
            <a href="/sign-in" className="fp-back-link">← Return to sign in</a>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="fp-form">
            <div className="fp-field">
              <label htmlFor="email" className="fp-label">Email address</label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="fp-input"
                required
                autoComplete="email"
                autoFocus
              />
            </div>
            <button type="submit" className="fp-submit-btn" disabled={loading}>
              {loading ? "Sending..." : "Send reset link"}
            </button>
            <a href="/sign-in" className="fp-back-link">← Back to sign in</a>
          </form>
        )}
      </div>

    </div>
  );
}
