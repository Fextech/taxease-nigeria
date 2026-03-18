"use client";

import { signIn } from "next-auth/react";
import { useSearchParams, useRouter } from "next/navigation";
import { Suspense, useState } from "react";
import Image from "next/image";

function SignInContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const callbackUrl = searchParams.get("callbackUrl") || "/overview";
  const error = searchParams.get("error");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
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
        <div className="signin-header text-center flex flex-col items-center">
          <div className="bg-white p-4 rounded-2xl shadow-sm mb-6 flex items-center justify-center" style={{ width: "200px", height: "60px" }}>
            <Image src="/Banklense-logo.svg" alt="Banklens Nigeria" width={160} height={64} style={{ width: "100%", height: "auto" }} priority />
          </div>
          {/* <h1 className="signin-title">Banklens Nigeria</h1> */}
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
            <div className="signin-password-wrapper">
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="signin-input"
                required
                autoComplete="current-password"
                minLength={8}
                style={{ paddingRight: "40px" }}
              />
              <button
                type="button"
                className="signin-password-toggle"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
                  {showPassword ? "visibility_off" : "visibility"}
                </span>
              </button>
            </div>
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
