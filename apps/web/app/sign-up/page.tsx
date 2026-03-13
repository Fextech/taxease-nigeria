"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function SignUpPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Something went wrong");
        return;
      }

      setSuccess(true);
      setTimeout(() => router.push("/sign-in"), 2000);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="signup-page">
      <div className="signup-card">
        {/* Logo & Branding */}
        <div className="signup-header">
          <div className="signup-logo">
            <span className="signup-logo-icon">🇳🇬</span>
          </div>
          <h1 className="signup-title">Create your account</h1>
          <p className="signup-subtitle">
            Get started with TaxEase Nigeria
          </p>
        </div>

        {/* Success Message */}
        {success && (
          <div className="signup-success">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5" />
              <path d="M5 8l2 2 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span>Account created! Redirecting to sign in...</span>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="signup-error">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5" />
              <path d="M8 4.5v4M8 10.5v.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            <span>{error}</span>
          </div>
        )}

        {!success && (
          <form onSubmit={handleSubmit} className="signup-form">
            <div className="signup-field">
              <label htmlFor="name" className="signup-label">Full Name</label>
              <input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="John Doe"
                className="signup-input"
                required
                minLength={2}
                autoComplete="name"
              />
            </div>
            <div className="signup-field">
              <label htmlFor="email" className="signup-label">Email</label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="signup-input"
                required
                autoComplete="email"
              />
            </div>
            <div className="signup-field">
              <label htmlFor="password" className="signup-label">Password</label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="signup-input"
                required
                minLength={8}
                autoComplete="new-password"
              />
              <span className="signup-hint">
                Min 8 characters, with uppercase, lowercase, and a number
              </span>
            </div>
            <div className="signup-field">
              <label htmlFor="confirmPassword" className="signup-label">Confirm Password</label>
              <input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                className="signup-input"
                required
                minLength={8}
                autoComplete="new-password"
              />
            </div>
            <button
              type="submit"
              className="signup-submit-btn"
              disabled={loading}
            >
              {loading ? "Creating account..." : "Create account"}
            </button>
          </form>
        )}

        {/* Sign In Link */}
        <p className="signup-signin-link">
          Already have an account?{" "}
          <a href="/sign-in" className="signup-link-accent">Sign in</a>
        </p>
      </div>

      {/* Background Decoration */}
      <div className="signup-bg-pattern" />

      <style jsx>{`
        .signup-page {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          background: linear-gradient(135deg, #1a3639 0%, #23494d 40%, #1a2e3a 100%);
          padding: 24px;
          position: relative;
          overflow: hidden;
        }

        .signup-bg-pattern {
          position: absolute;
          inset: 0;
          background-image:
            radial-gradient(circle at 20% 80%, rgba(240, 160, 48, 0.08) 0%, transparent 50%),
            radial-gradient(circle at 80% 20%, rgba(45, 94, 99, 0.15) 0%, transparent 50%),
            radial-gradient(circle at 50% 50%, rgba(255, 255, 255, 0.02) 0%, transparent 70%);
          pointer-events: none;
        }

        .signup-card {
          position: relative;
          z-index: 1;
          width: 100%;
          max-width: 420px;
          background: rgba(255, 255, 255, 0.04);
          backdrop-filter: blur(24px);
          -webkit-backdrop-filter: blur(24px);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 20px;
          padding: 48px 40px;
          box-shadow:
            0 24px 48px rgba(0, 0, 0, 0.3),
            0 0 0 1px rgba(255, 255, 255, 0.05) inset;
        }

        .signup-header {
          text-align: center;
          margin-bottom: 32px;
        }

        .signup-logo {
          width: 64px;
          height: 64px;
          border-radius: 16px;
          background: linear-gradient(135deg, #f0a030, #e8912a);
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 0 auto 20px;
          box-shadow: 0 8px 24px rgba(240, 160, 48, 0.3);
        }

        .signup-logo-icon {
          font-size: 32px;
          line-height: 1;
        }

        .signup-title {
          font-size: 26px;
          font-weight: 700;
          color: #ffffff;
          letter-spacing: -0.02em;
          margin-bottom: 8px;
        }

        .signup-subtitle {
          font-size: 15px;
          color: rgba(255, 255, 255, 0.5);
          line-height: 1.5;
        }

        .signup-success {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 12px 16px;
          border-radius: 10px;
          background: rgba(34, 197, 94, 0.12);
          border: 1px solid rgba(34, 197, 94, 0.2);
          color: #86efac;
          font-size: 13px;
          margin-bottom: 24px;
          line-height: 1.4;
        }

        .signup-error {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 12px 16px;
          border-radius: 10px;
          background: rgba(239, 68, 68, 0.12);
          border: 1px solid rgba(239, 68, 68, 0.2);
          color: #fca5a5;
          font-size: 13px;
          margin-bottom: 24px;
          line-height: 1.4;
        }

        .signup-form {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .signup-field {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .signup-label {
          font-size: 13px;
          font-weight: 500;
          color: rgba(255, 255, 255, 0.6);
        }

        .signup-input {
          width: 100%;
          padding: 12px 16px;
          border-radius: 10px;
          background: rgba(255, 255, 255, 0.06);
          border: 1px solid rgba(255, 255, 255, 0.1);
          color: #ffffff;
          font-size: 14px;
          font-family: var(--font-sans), system-ui, sans-serif;
          outline: none;
          transition: all 0.2s ease;
        }

        .signup-input::placeholder {
          color: rgba(255, 255, 255, 0.25);
        }

        .signup-input:focus {
          border-color: rgba(240, 160, 48, 0.5);
          background: rgba(255, 255, 255, 0.08);
          box-shadow: 0 0 0 3px rgba(240, 160, 48, 0.1);
        }

        .signup-hint {
          font-size: 11px;
          color: rgba(255, 255, 255, 0.3);
        }

        .signup-submit-btn {
          width: 100%;
          padding: 14px 24px;
          border-radius: 12px;
          background: linear-gradient(135deg, #f0a030, #e8912a);
          color: #ffffff;
          font-size: 15px;
          font-weight: 600;
          border: none;
          cursor: pointer;
          transition: all 0.2s ease;
          font-family: var(--font-sans), system-ui, sans-serif;
          margin-top: 4px;
          box-shadow: 0 4px 16px rgba(240, 160, 48, 0.25);
        }

        .signup-submit-btn:hover:not(:disabled) {
          background: linear-gradient(135deg, #f5bc62, #f0a030);
          transform: translateY(-1px);
          box-shadow: 0 6px 24px rgba(240, 160, 48, 0.35);
        }

        .signup-submit-btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .signup-signin-link {
          text-align: center;
          font-size: 14px;
          color: rgba(255, 255, 255, 0.4);
          margin-top: 24px;
        }

        .signup-link-accent {
          color: #f0a030;
          text-decoration: none;
          font-weight: 600;
          transition: color 0.2s;
        }

        .signup-link-accent:hover {
          color: #f5bc62;
        }

        @media (max-width: 480px) {
          .signup-card {
            padding: 36px 24px;
            border-radius: 16px;
          }

          .signup-title {
            font-size: 22px;
          }
        }
      `}</style>
    </div>
  );
}
