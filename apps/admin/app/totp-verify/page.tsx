"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAdminStore } from "@/stores/admin-store";

export default function TotpVerifyPage() {
  const router = useRouter();
  const { setToken, setAdmin } = useAdminStore();
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const adminId = sessionStorage.getItem("adminId");
      if (!adminId) {
        router.push("/login");
        return;
      }

      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001"}/trpc/admin.auth.verifyTotp`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ adminId, code }),
        }
      );

      if (!res.ok) {
        throw new Error("Invalid TOTP code");
      }

      const data = await res.json();
      sessionStorage.removeItem("adminId");

      setToken(data.result?.data?.token);
      setAdmin(data.result?.data?.admin);

      // Set cookie for middleware
      document.cookie = `admin_token=${data.result?.data?.token}; path=/; max-age=${8 * 60 * 60}; samesite=strict`;

      router.push("/dashboard");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Verification failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="admin-auth-page">
      <div className="admin-auth-card">
        <div className="admin-auth-logo">
          <div className="admin-sidebar-logo" style={{ width: 44, height: 44 }}>
            <span className="material-symbols-outlined" style={{ fontSize: 24 }}>
              verified_user
            </span>
          </div>
        </div>

        <h1 className="admin-auth-title">Two-Factor Verification</h1>
        <p className="admin-auth-subtitle">
          Enter the 6-digit code from your authenticator app
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

        <form onSubmit={handleVerify}>
          <div style={{ marginBottom: 24 }}>
            <label className="admin-label">TOTP Code</label>
            <input
              type="text"
              className="admin-input"
              placeholder="000000"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              required
              maxLength={6}
              autoFocus
              style={{ textAlign: "center", fontSize: 24, letterSpacing: "0.3em", fontWeight: 700 }}
            />
          </div>

          <button
            type="submit"
            className="admin-btn admin-btn--primary"
            disabled={loading || code.length !== 6}
            style={{ width: "100%", justifyContent: "center", padding: "12px 0", fontSize: 14 }}
          >
            {loading ? "Verifying..." : "Verify & Continue"}
          </button>
        </form>

        <button
          className="admin-btn admin-btn--ghost"
          style={{ width: "100%", justifyContent: "center", marginTop: 12 }}
          onClick={() => router.push("/login")}
        >
          Back to Login
        </button>
      </div>
    </div>
  );
}
