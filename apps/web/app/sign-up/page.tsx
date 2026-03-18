"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import Image from "next/image";
import Link from "next/link";

export default function SignUpPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
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
        <div className="signup-header text-center flex flex-col items-center">
          <div className="bg-white p-4 rounded-2xl shadow-sm mb-6 flex items-center justify-center" style={{ width: "200px", height: "60px" }}>
            <Image src="/Banklense-logo.svg" alt="Banklens Nigeria" width={160} height={64} style={{ width: "100%", height: "auto" }} priority />
          </div>
          {/* <h1 className="signup-title">Create your account</h1> */}
          <p className="signup-subtitle">
            Get started with Banklens Nigeria
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
              <div className="signup-password-wrapper">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="signup-input"
                  required
                  minLength={8}
                  autoComplete="new-password"
                  style={{ paddingRight: "40px" }}
                />
                <button
                  type="button"
                  className="signup-password-toggle"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
                    {showPassword ? "visibility_off" : "visibility"}
                  </span>
                </button>
              </div>
              <span className="signup-hint">
                Min 8 characters, with uppercase, lowercase, and a number
              </span>
            </div>
            <div className="signup-field">
              <label htmlFor="confirmPassword" className="signup-label">Confirm Password</label>
              <div className="signup-password-wrapper">
                <input
                  id="confirmPassword"
                  type={showConfirmPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  className="signup-input"
                  required
                  minLength={8}
                  autoComplete="new-password"
                  style={{ paddingRight: "40px" }}
                />
                <button
                  type="button"
                  className="signup-password-toggle"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
                    {showConfirmPassword ? "visibility_off" : "visibility"}
                  </span>
                </button>
              </div>
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
          <Link href="/sign-in" className="signup-link-accent">Sign in</Link>
        </p>

        {/* Footer Info */}
        <p className="signup-footer mt-6 text-center text-[13px] text-slate-400">
          By signing up, you agree to our{" "}
          <Link href="/terms" className="signup-link hover:text-white transition-colors underline underline-offset-2">Terms of Service</Link>
          {" "}and{" "}
          <Link href="/privacy" className="signup-link hover:text-white transition-colors underline underline-offset-2">Privacy Policy</Link>.
        </p>
      </div>

    </div>
  );
}
