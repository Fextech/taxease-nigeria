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
              If an account exists with <strong>{email}</strong>, you'll receive an email with a reset link shortly.
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

      <div className="fp-bg-pattern" />

      <style jsx>{`
        .fp-page {
          min-height: 100vh; display: flex; align-items: center; justify-content: center;
          background: linear-gradient(135deg, #1a3639 0%, #23494d 40%, #1a2e3a 100%);
          padding: 24px; position: relative; overflow: hidden;
        }
        .fp-bg-pattern {
          position: absolute; inset: 0; pointer-events: none;
          background-image:
            radial-gradient(circle at 20% 80%, rgba(240, 160, 48, 0.08) 0%, transparent 50%),
            radial-gradient(circle at 80% 20%, rgba(45, 94, 99, 0.15) 0%, transparent 50%);
        }
        .fp-card {
          position: relative; z-index: 1; width: 100%; max-width: 420px;
          background: rgba(255, 255, 255, 0.04); backdrop-filter: blur(24px);
          border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 20px;
          padding: 48px 40px;
          box-shadow: 0 24px 48px rgba(0, 0, 0, 0.3), 0 0 0 1px rgba(255, 255, 255, 0.05) inset;
        }
        .fp-header { text-align: center; margin-bottom: 32px; }
        .fp-icon {
          width: 64px; height: 64px; border-radius: 16px;
          background: linear-gradient(135deg, #23494d, #2d5e63);
          display: flex; align-items: center; justify-content: center;
          margin: 0 auto 20px; color: #f0a030;
          box-shadow: 0 8px 24px rgba(35, 73, 77, 0.4);
        }
        .fp-title { font-size: 24px; font-weight: 700; color: #fff; margin-bottom: 8px; }
        .fp-subtitle { font-size: 14px; color: rgba(255,255,255,0.5); line-height: 1.5; }
        .fp-error {
          display: flex; align-items: center; gap: 10px;
          padding: 12px 16px; border-radius: 10px; margin-bottom: 24px;
          background: rgba(239, 68, 68, 0.12); border: 1px solid rgba(239, 68, 68, 0.2);
          color: #fca5a5; font-size: 13px;
        }
        .fp-form { display: flex; flex-direction: column; gap: 16px; }
        .fp-field { display: flex; flex-direction: column; gap: 6px; }
        .fp-label { font-size: 13px; font-weight: 500; color: rgba(255,255,255,0.6); }
        .fp-input {
          width: 100%; padding: 12px 16px; border-radius: 10px;
          background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1);
          color: #fff; font-size: 14px; outline: none; transition: all 0.2s;
          font-family: var(--font-sans), system-ui, sans-serif;
        }
        .fp-input::placeholder { color: rgba(255,255,255,0.25); }
        .fp-input:focus { border-color: rgba(240, 160, 48, 0.5); box-shadow: 0 0 0 3px rgba(240, 160, 48, 0.1); }
        .fp-submit-btn {
          width: 100%; padding: 14px 24px; border-radius: 12px;
          background: linear-gradient(135deg, #f0a030, #e8912a); color: #fff;
          font-size: 15px; font-weight: 600; border: none; cursor: pointer;
          transition: all 0.2s; font-family: var(--font-sans), system-ui, sans-serif;
          box-shadow: 0 4px 16px rgba(240, 160, 48, 0.25);
        }
        .fp-submit-btn:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 6px 24px rgba(240, 160, 48, 0.35); }
        .fp-submit-btn:disabled { opacity: 0.6; cursor: not-allowed; }
        .fp-back-link {
          display: block; text-align: center; font-size: 14px;
          color: rgba(255,255,255,0.4); text-decoration: none; margin-top: 8px;
          transition: color 0.2s;
        }
        .fp-back-link:hover { color: #f0a030; }
        .fp-sent { text-align: center; }
        .fp-sent-icon { color: rgba(240, 160, 48, 0.7); margin-bottom: 20px; }
        .fp-sent-text { font-size: 14px; color: rgba(255,255,255,0.5); line-height: 1.6; margin-bottom: 24px; }
        .fp-sent-text strong { color: #fff; }
        @media (max-width: 480px) { .fp-card { padding: 36px 24px; } }
      `}</style>
    </div>
  );
}
