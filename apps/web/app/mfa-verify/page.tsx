"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState, useRef, useEffect } from "react";

export default function MfaVerifyPage() {
  const { data: session, update } = useSession();
  const router = useRouter();
  const [code, setCode] = useState(["", "", "", "", "", ""]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    inputRefs.current[0]?.focus();
  }, []);

  const handleChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;
    const newCode = [...code];
    newCode[index] = value.slice(-1);
    setCode(newCode);
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !code[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    const newCode = [...code];
    for (let i = 0; i < 6; i++) {
      newCode[i] = pasted[i] || "";
    }
    setCode(newCode);
    const focusIdx = Math.min(pasted.length, 5);
    inputRefs.current[focusIdx]?.focus();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const fullCode = code.join("");
    if (fullCode.length !== 6) {
      setError("Please enter the full 6-digit code");
      return;
    }

    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/mfa/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: fullCode }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Invalid code. Please try again.");
        setCode(["", "", "", "", "", ""]);
        inputRefs.current[0]?.focus();
        return;
      }

      // Update the session to mark MFA as verified
      await update({ mfaVerified: true });
      router.push("/overview");
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mfa-page">
      <div className="mfa-card">
        <div className="mfa-header">
          <div className="mfa-icon">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <rect x="5" y="11" width="14" height="10" rx="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              <circle cx="12" cy="16" r="1" />
            </svg>
          </div>
          <h1 className="mfa-title">Two-Factor Authentication</h1>
          <p className="mfa-subtitle">
            Enter the 6-digit code from your authenticator app
          </p>
        </div>

        {error && (
          <div className="mfa-error">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5" />
              <path d="M8 4.5v4M8 10.5v.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="mfa-code-inputs" onPaste={handlePaste}>
            {code.map((digit, i) => (
              <input
                key={i}
                ref={(el) => { inputRefs.current[i] = el; }}
                type="text"
                inputMode="numeric"
                maxLength={1}
                value={digit}
                onChange={(e) => handleChange(i, e.target.value)}
                onKeyDown={(e) => handleKeyDown(i, e)}
                className="mfa-code-input"
                autoComplete="one-time-code"
              />
            ))}
          </div>

          <button type="submit" className="mfa-submit-btn" disabled={loading}>
            {loading ? "Verifying..." : "Verify"}
          </button>
        </form>

        <p className="mfa-help">
          Open your authenticator app (Google Authenticator, Authy, etc.) to find your verification code.
        </p>
      </div>

      <div className="mfa-bg-pattern" />

      <style jsx>{`
        .mfa-page {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          background: linear-gradient(135deg, #1a3639 0%, #23494d 40%, #1a2e3a 100%);
          padding: 24px;
          position: relative;
          overflow: hidden;
        }
        .mfa-bg-pattern {
          position: absolute;
          inset: 0;
          background-image:
            radial-gradient(circle at 20% 80%, rgba(240, 160, 48, 0.08) 0%, transparent 50%),
            radial-gradient(circle at 80% 20%, rgba(45, 94, 99, 0.15) 0%, transparent 50%);
          pointer-events: none;
        }
        .mfa-card {
          position: relative;
          z-index: 1;
          width: 100%;
          max-width: 420px;
          background: rgba(255, 255, 255, 0.04);
          backdrop-filter: blur(24px);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 20px;
          padding: 48px 40px;
          box-shadow: 0 24px 48px rgba(0, 0, 0, 0.3), 0 0 0 1px rgba(255, 255, 255, 0.05) inset;
        }
        .mfa-header { text-align: center; margin-bottom: 32px; }
        .mfa-icon {
          width: 64px; height: 64px; border-radius: 16px;
          background: linear-gradient(135deg, #23494d, #2d5e63);
          display: flex; align-items: center; justify-content: center;
          margin: 0 auto 20px;
          color: #f0a030;
          box-shadow: 0 8px 24px rgba(35, 73, 77, 0.4);
        }
        .mfa-title { font-size: 24px; font-weight: 700; color: #fff; margin-bottom: 8px; }
        .mfa-subtitle { font-size: 14px; color: rgba(255,255,255,0.5); line-height: 1.5; }
        .mfa-error {
          display: flex; align-items: center; gap: 10px;
          padding: 12px 16px; border-radius: 10px;
          background: rgba(239, 68, 68, 0.12); border: 1px solid rgba(239, 68, 68, 0.2);
          color: #fca5a5; font-size: 13px; margin-bottom: 24px;
        }
        .mfa-code-inputs {
          display: flex; gap: 10px; justify-content: center; margin-bottom: 24px;
        }
        .mfa-code-input {
          width: 48px; height: 56px; text-align: center;
          font-size: 22px; font-weight: 700; color: #fff;
          background: rgba(255, 255, 255, 0.06);
          border: 1px solid rgba(255, 255, 255, 0.12);
          border-radius: 12px; outline: none;
          font-family: var(--font-sans), system-ui, monospace;
          transition: all 0.2s ease;
        }
        .mfa-code-input:focus {
          border-color: rgba(240, 160, 48, 0.5);
          background: rgba(255, 255, 255, 0.08);
          box-shadow: 0 0 0 3px rgba(240, 160, 48, 0.1);
        }
        .mfa-submit-btn {
          width: 100%; padding: 14px 24px; border-radius: 12px;
          background: linear-gradient(135deg, #f0a030, #e8912a);
          color: #fff; font-size: 15px; font-weight: 600;
          border: none; cursor: pointer;
          transition: all 0.2s ease;
          font-family: var(--font-sans), system-ui, sans-serif;
          box-shadow: 0 4px 16px rgba(240, 160, 48, 0.25);
        }
        .mfa-submit-btn:hover:not(:disabled) {
          background: linear-gradient(135deg, #f5bc62, #f0a030);
          transform: translateY(-1px);
          box-shadow: 0 6px 24px rgba(240, 160, 48, 0.35);
        }
        .mfa-submit-btn:disabled { opacity: 0.6; cursor: not-allowed; }
        .mfa-help {
          text-align: center; font-size: 12px; color: rgba(255,255,255,0.3);
          line-height: 1.5; margin-top: 20px;
        }
        @media (max-width: 480px) {
          .mfa-card { padding: 36px 24px; }
          .mfa-code-input { width: 42px; height: 50px; font-size: 20px; }
        }
      `}</style>
    </div>
  );
}
