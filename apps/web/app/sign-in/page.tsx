"use client";

import { signIn } from "next-auth/react";
import { useSearchParams, useRouter } from "next/navigation";
import { Suspense, useState } from "react";

function SignInContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const callbackUrl = searchParams.get("callbackUrl") || "/overview";
  const error = searchParams.get("error");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState("");

  const handleCredentialsSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");
    setLoading(true);

    try {
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      if (result?.error) {
        setFormError("Invalid email or password");
      } else {
        router.push(callbackUrl);
      }
    } catch {
      setFormError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const displayError =
    formError ||
    (error === "OAuthAccountNotLinked"
      ? "This email is already associated with another sign-in method."
      : error === "CredentialsSignin"
        ? "Invalid email or password."
        : error
          ? "Something went wrong. Please try again."
          : "");

  return (
    <div className="signin-page">
      <div className="signin-card">
        {/* Logo & Branding */}
        <div className="signin-header">
          <div className="signin-logo">
            <span className="signin-logo-icon">🇳🇬</span>
          </div>
          <h1 className="signin-title">TaxEase Nigeria</h1>
          <p className="signin-subtitle">
            Sign in to manage your tax returns
          </p>
        </div>

        {/* Error Message */}
        {displayError && (
          <div className="signin-error">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5" />
              <path d="M8 4.5v4M8 10.5v.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            <span>{displayError}</span>
          </div>
        )}

        {/* Google Sign-In Button */}
        <button
          className="signin-google-btn"
          onClick={() => signIn("google", { callbackUrl })}
          type="button"
        >
          <svg width="20" height="20" viewBox="0 0 24 24">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
          </svg>
          <span>Continue with Google</span>
        </button>

        {/* Divider */}
        <div className="signin-divider">
          <div className="signin-divider-line" />
          <span className="signin-divider-text">or</span>
          <div className="signin-divider-line" />
        </div>

        {/* Email/Password Form */}
        <form onSubmit={handleCredentialsSignIn} className="signin-form">
          <div className="signin-field">
            <label htmlFor="email" className="signin-label">Email</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="signin-input"
              required
              autoComplete="email"
            />
          </div>
          <div className="signin-field">
            <div className="signin-field-row">
              <label htmlFor="password" className="signin-label">Password</label>
              <a href="/forgot-password" className="signin-forgot">Forgot password?</a>
            </div>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="signin-input"
              required
              autoComplete="current-password"
              minLength={8}
            />
          </div>
          <button
            type="submit"
            className="signin-submit-btn"
            disabled={loading}
          >
            {loading ? "Signing in..." : "Sign in"}
          </button>
        </form>

        {/* Sign Up Link */}
        <p className="signin-signup-link">
          Don&apos;t have an account?{" "}
          <a href="/sign-up" className="signin-link-accent">Create one</a>
        </p>

        {/* Footer Info */}
        <p className="signin-footer">
          By signing in, you agree to our{" "}
          <a href="/terms" className="signin-link">Terms of Service</a>
          {" "}and{" "}
          <a href="/privacy" className="signin-link">Privacy Policy</a>.
        </p>
      </div>

      {/* Background Decoration */}
      <div className="signin-bg-pattern" />

      <style jsx>{`
        .signin-page {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          background: linear-gradient(135deg, #1a3639 0%, #23494d 40%, #1a2e3a 100%);
          padding: 24px;
          position: relative;
          overflow: hidden;
        }

        .signin-bg-pattern {
          position: absolute;
          inset: 0;
          background-image:
            radial-gradient(circle at 20% 80%, rgba(240, 160, 48, 0.08) 0%, transparent 50%),
            radial-gradient(circle at 80% 20%, rgba(45, 94, 99, 0.15) 0%, transparent 50%),
            radial-gradient(circle at 50% 50%, rgba(255, 255, 255, 0.02) 0%, transparent 70%);
          pointer-events: none;
        }

        .signin-card {
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

        .signin-header {
          text-align: center;
          margin-bottom: 32px;
        }

        .signin-logo {
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

        .signin-logo-icon {
          font-size: 32px;
          line-height: 1;
        }

        .signin-title {
          font-size: 26px;
          font-weight: 700;
          color: #ffffff;
          letter-spacing: -0.02em;
          margin-bottom: 8px;
        }

        .signin-subtitle {
          font-size: 15px;
          color: rgba(255, 255, 255, 0.5);
          line-height: 1.5;
        }

        .signin-error {
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

        .signin-google-btn {
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 12px;
          padding: 14px 24px;
          border-radius: 12px;
          background: #ffffff;
          color: #1a1a2e;
          font-size: 15px;
          font-weight: 600;
          border: none;
          cursor: pointer;
          transition: all 0.2s ease;
          font-family: var(--font-sans), system-ui, sans-serif;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
        }

        .signin-google-btn:hover {
          background: #f8f8f8;
          transform: translateY(-1px);
          box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
        }

        .signin-google-btn:active {
          transform: translateY(0);
        }

        .signin-divider {
          display: flex;
          align-items: center;
          gap: 16px;
          margin: 24px 0;
        }

        .signin-divider-line {
          flex: 1;
          height: 1px;
          background: rgba(255, 255, 255, 0.08);
        }

        .signin-divider-text {
          font-size: 12px;
          color: rgba(255, 255, 255, 0.3);
          text-transform: uppercase;
          letter-spacing: 0.08em;
        }

        .signin-form {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .signin-field {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .signin-label {
          font-size: 13px;
          font-weight: 500;
          color: rgba(255, 255, 255, 0.6);
        }

        .signin-field-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .signin-forgot {
          font-size: 12px;
          color: rgba(240, 160, 48, 0.7);
          text-decoration: none;
          transition: color 0.2s;
        }

        .signin-forgot:hover {
          color: #f0a030;
        }

        .signin-input {
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

        .signin-input::placeholder {
          color: rgba(255, 255, 255, 0.25);
        }

        .signin-input:focus {
          border-color: rgba(240, 160, 48, 0.5);
          background: rgba(255, 255, 255, 0.08);
          box-shadow: 0 0 0 3px rgba(240, 160, 48, 0.1);
        }

        .signin-submit-btn {
          width: 100%;
          padding: 14px 24px;
          border-radius: 12px;
          background: linear-gradient(135deg, #23494d, #2d5e63);
          color: #ffffff;
          font-size: 15px;
          font-weight: 600;
          border: 1px solid rgba(255, 255, 255, 0.1);
          cursor: pointer;
          transition: all 0.2s ease;
          font-family: var(--font-sans), system-ui, sans-serif;
          margin-top: 4px;
        }

        .signin-submit-btn:hover:not(:disabled) {
          background: linear-gradient(135deg, #2d5e63, #347075);
          transform: translateY(-1px);
          box-shadow: 0 4px 16px rgba(35, 73, 77, 0.4);
        }

        .signin-submit-btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .signin-signup-link {
          text-align: center;
          font-size: 14px;
          color: rgba(255, 255, 255, 0.4);
          margin-top: 20px;
        }

        .signin-link-accent {
          color: #f0a030;
          text-decoration: none;
          font-weight: 600;
          transition: color 0.2s;
        }

        .signin-link-accent:hover {
          color: #f5bc62;
        }

        .signin-footer {
          text-align: center;
          font-size: 12px;
          color: rgba(255, 255, 255, 0.25);
          line-height: 1.6;
          margin-top: 20px;
        }

        .signin-link {
          color: rgba(240, 160, 48, 0.6);
          text-decoration: none;
          transition: color 0.2s;
        }

        .signin-link:hover {
          color: #f0a030;
        }

        @media (max-width: 480px) {
          .signin-card {
            padding: 36px 24px;
            border-radius: 16px;
          }

          .signin-title {
            font-size: 22px;
          }
        }
      `}</style>
    </div>
  );
}

export default function SignInPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: "100vh", background: "#1a3639" }} />}>
      <SignInContent />
    </Suspense>
  );
}
