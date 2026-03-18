"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAdminStore } from "@/stores/admin-store";

export default function AdminLoginPage() {
  const router = useRouter();
  const { setToken, setAdmin } = useAdminStore();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001"}/trpc/admin.auth.login`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password }),
        }
      );

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error?.message || "Invalid credentials");
      }

      const data = await res.json();

      if (data.result?.data?.requiresTotp) {
        // Need TOTP verification
        sessionStorage.setItem("adminId", data.result.data.adminId);
        router.push("/totp-verify");
        return;
      }

      // Full login successful
      setToken(data.result?.data?.token);
      setAdmin(data.result?.data?.admin);

      // Set cookie for middleware
      document.cookie = `admin_token=${data.result?.data?.token}; path=/; max-age=${8 * 60 * 60}; samesite=strict`;

      router.push("/dashboard");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="admin-auth-page">
      <div className="admin-auth-card">
        <div className="admin-auth-logo">
          <div
            className="admin-sidebar-logo"
            style={{ width: 44, height: 44 }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 24 }}>
              account_balance
            </span>
          </div>
        </div>

        <h1 className="admin-auth-title">Admin Login</h1>
        <p className="admin-auth-subtitle">
          Sign in to the BankLens Nigeria control panel
        </p>

        {error && (
          <div
            style={{
              background: "rgba(239, 68, 68, 0.1)",
              border: "1px solid rgba(239, 68, 68, 0.3)",
              borderRadius: "var(--admin-radius)",
              padding: "10px 14px",
              marginBottom: 20,
              fontSize: 13,
              color: "#ef4444",
            }}
          >
            {error}
          </div>
        )}

        <form onSubmit={handleLogin}>
          <div style={{ marginBottom: 16 }}>
            <label className="admin-label">Email Address</label>
            <input
              type="email"
              className="admin-input"
              placeholder="admin@banklens.ng"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </div>

          <div style={{ marginBottom: 24 }}>
            <label className="admin-label">Password</label>
            <input
              type="password"
              className="admin-input"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
            />
          </div>

          <button
            type="submit"
            className="admin-btn admin-btn--primary"
            disabled={loading}
            style={{ width: "100%", justifyContent: "center", padding: "12px 0", fontSize: 14 }}
          >
            {loading ? (
              <>
                <span className="material-symbols-outlined" style={{ fontSize: 18, animation: "spin 1s linear infinite" }}>
                  progress_activity
                </span>
                Signing in...
              </>
            ) : (
              "Sign In"
            )}
          </button>
        </form>

        <p
          style={{
            fontSize: 12,
            color: "var(--admin-text-muted)",
            textAlign: "center",
            marginTop: 24,
            margin: "24px 0 0",
          }}
        >
          Contact a Super Admin if you need access
        </p>
      </div>
    </div>
  );
}
