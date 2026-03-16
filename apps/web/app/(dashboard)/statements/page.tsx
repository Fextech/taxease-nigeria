"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useWorkspace } from "@/components/dashboard/WorkspaceContext";
import { StatementUploader } from "@/components/dashboard/StatementUploader";

const months = [
  { short: "JAN", full: "January" },
  { short: "FEB", full: "February" },
  { short: "MAR", full: "March" },
  { short: "APR", full: "April" },
  { short: "MAY", full: "May" },
  { short: "JUN", full: "June" },
  { short: "JUL", full: "July" },
  { short: "AUG", full: "August" },
  { short: "SEP", full: "September" },
  { short: "OCT", full: "October" },
  { short: "NOV", full: "November" },
  { short: "DEC", full: "December" },
];



type StatementInfo = {
  id: string;
  month: number;
  originalFilename: string;
  parseStatus: string;
  bankName?: string;
  confidenceScore?: number;
  rowCount?: number;
  errorMessage?: string;
};

type UploadState = "idle" | "uploading" | "confirming" | "done" | "error";

// Simple file hash using SubtleCrypto
async function hashFile(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

export default function StatementsPage() {
  useSession();
  const { activeWorkspaceId, activeWorkspace } = useWorkspace();

  const [selectedMonth, setSelectedMonth] = useState(0);
  const [statements, setStatements] = useState<StatementInfo[]>([]);
  const [uploadState, setUploadState] = useState<UploadState>("idle");
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState("");
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  // Unlock modal state
  const [showUnlockModal, setShowUnlockModal] = useState(false);
  const [lockedMonthClicked, setLockedMonthClicked] = useState<number | null>(null);
  const router = useRouter();

  // Password modal state
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [pdfPassword, setPdfPassword] = useState("");
  const [checkingPassword, setCheckingPassword] = useState(false);

  // ETA tracking
  const [uploadStartTime, setUploadStartTime] = useState<number | null>(null);

  // Estimate ETA based on progress
  useEffect(() => {
    if (uploadStartTime && uploadProgress > 0 && uploadProgress < 100 && uploadState !== "done" && uploadState !== "error") {
      // Logic for ETA (visual implementation only, actual UI relies on ETA logic elsewhere)
    }
  }, [uploadProgress, uploadStartTime, uploadState]);

  // Check if a PDF file is password protected
  async function isPdfPasswordProtected(file: File): Promise<boolean> {
    if (file.type !== "application/pdf") return false;
    // /Encrypt is typically found in the PDF trailer at the end of the file
    const slice = file.size > 1024 * 1024 ? file.slice(file.size - 1024 * 1024) : file;
    try {
      const text = await slice.text();
      return text.includes("/Encrypt");
    } catch {
      return false;
    }
  }

  // Fetch statements when active workspace changes
  useEffect(() => {
    if (activeWorkspaceId) {
      loadStatements(activeWorkspaceId);
    } else {
      setStatements([]);
    }
  }, [activeWorkspaceId]);

  // Background polling: check PROCESSING statements every 5s
  useEffect(() => {
    const hasProcessing = statements.some(
      (s) => s.parseStatus === "PROCESSING" || s.parseStatus === "UPLOADED"
    );
    if (!hasProcessing || !activeWorkspaceId) return;

    const intervalId = setInterval(async () => {
      try {
        const res = await fetch("/api/statements/upload", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "list", workspaceId: activeWorkspaceId }),
        });
        if (!res.ok) return;
        const fresh: StatementInfo[] = await res.json();

        setStatements((prev) => {
          // Detect completions
          for (const prevS of prev) {
            if (prevS.parseStatus !== "PROCESSING" && prevS.parseStatus !== "UPLOADED") continue;
            const freshS = fresh.find((f) => f.id === prevS.id);
            if (!freshS) continue;
            if (freshS.parseStatus === "READY") {
              setToast({ message: `✅ ${prevS.originalFilename} processed successfully!`, type: "success" });
              setTimeout(() => setToast(null), 6000);
            } else if (freshS.parseStatus === "ERROR") {
              setToast({ message: `❌ ${prevS.originalFilename} failed to process. Retrying…`, type: "error" });
              setTimeout(() => setToast(null), 8000);
            }
          }
          return fresh;
        });
      } catch {
        // Silent fail on poll errors
      }
    }, 5000);

    return () => clearInterval(intervalId);
  }, [statements, activeWorkspaceId]);

  async function loadStatements(wsId: string) {
    try {
      const res = await fetch("/api/statements/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "list", workspaceId: wsId }),
      });

      if (res.ok) {
        const data = await res.json();
        setStatements(Array.isArray(data) ? data : []);
      }
    } catch {
      // Silent fail — statements will show as empty
    }
  }

  const handleFileSelect = useCallback(
    async (file: File, skipPasswordCheck = false, password = "") => {
      // Validate file type
      const allowedTypes = [
        "application/pdf",
        "text/csv",
        "application/vnd.ms-excel",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      ];

      if (!allowedTypes.includes(file.type)) {
        setError("Unsupported file type. Please upload a PDF, CSV, or Excel file.");
        return;
      }

      // Validate file size (20 MB max)
      if (file.size > 20 * 1024 * 1024) {
        setError("File is too large. Maximum size is 20 MB.");
        return;
      }

      setError("");

      // Check password protection for PDFs
      if (file.type === "application/pdf" && !skipPasswordCheck) {
        const isProtected = await isPdfPasswordProtected(file);
        if (isProtected) {
          setPendingFile(file);
          setShowPasswordModal(true);
          return; // Wait for user to enter password via modal
        }
      }

      setUploadState("uploading");
      setUploadProgress(10);
      setUploadStartTime(Date.now());

      try {
        // Hash the file for duplicate detection
        const fileHash = await hashFile(file);
        setUploadProgress(25);

        if (!activeWorkspaceId) {
          setError("No Tax Year selected. Please select a Tax Year from the header first.");
          setUploadState("error");
          return;
        }

        // Step 1: Get presigned upload URL
        const urlRes = await fetch("/api/statements/upload", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "getUploadUrl",
            workspaceId: activeWorkspaceId,
            month: selectedMonth + 1,
            filename: file.name,
            mimeType: file.type,
            fileSize: file.size,
            fileHash,
          }),
        });

        if (!urlRes.ok) {
          const errData = await urlRes.json();
          throw new Error(errData.error || "Failed to get upload URL");
        }

        const { uploadUrl, s3Key, devMode } = await urlRes.json();
        setUploadProgress(40);

        // Step 2: Upload to S3 (or skip in dev mode)
        if (uploadUrl && !devMode) {
          const s3Res = await fetch(uploadUrl, {
            method: "PUT",
            headers: { "Content-Type": file.type },
            body: file,
          });

          if (!s3Res.ok) {
            throw new Error("Failed to upload file to storage");
          }
        }

        setUploadProgress(70);
        setUploadState("confirming");

        // Step 3: Confirm upload
        const confirmRes = await fetch("/api/statements/upload", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "confirm",
            workspaceId: activeWorkspaceId,
            month: selectedMonth + 1,
            s3Key,
            originalFilename: file.name,
            mimeType: file.type,
            fileHash,
            pdfPassword: password, // Included for the parser worker
          }),
        });

        if (!confirmRes.ok) {
          const errData = await confirmRes.json();
          throw new Error(errData.error || "Failed to confirm upload");
        }

        const statement = await confirmRes.json();
        setUploadProgress(100);
        setUploadState("done");

        // Add to local state (append, don't replace)
        setStatements((prev) => [
          ...prev,
          {
            id: statement.id,
            month: statement.month,
            originalFilename: file.name,
            parseStatus: statement.parseStatus,
          },
        ]);

        // Reset after 2 seconds
        setTimeout(() => {
          setUploadState("idle");
          setUploadProgress(0);
        }, 2000);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Upload failed";
        setError(message);
        setUploadState("error");
        setTimeout(() => {
          setUploadState("idle");
          setUploadProgress(0);
        }, 3000);
      }
    },
    [selectedMonth, activeWorkspaceId]
  );


  const handleDelete = async (statementId: string) => {
    if (!confirm("Delete this statement? This cannot be undone.")) return;

    try {
      const res = await fetch("/api/statements/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete", statementId }),
      });

      if (res.ok) {
        setStatements((prev) => prev.filter((s) => s.id !== statementId));
      }
    } catch {
      setError("Failed to delete statement");
    }
  };

  // Get statements for a month (supports multiple per month)
  const getMonthStatements = (monthIndex: number) =>
    statements.filter((s) => s.month === monthIndex + 1);

  const processedCount = statements.filter(
    (s) => s.parseStatus === "READY" || s.parseStatus === "ANNOTATED"
  ).length;

  const currentMonthStatements = getMonthStatements(selectedMonth);
  const allowedBanks = activeWorkspace?.allowedBanksCount ?? 1;
  const canAddMore = currentMonthStatements.length < allowedBanks;

  return (
    <>
      {/* Toast notification */}
      {toast && (
        <div
          style={{
            position: "fixed",
            bottom: 24,
            right: 24,
            zIndex: 9999,
            background: toast.type === "success" ? "var(--te-success, #22c55e)" : "var(--te-error, #ef4444)",
            color: "#fff",
            padding: "12px 20px",
            borderRadius: 10,
            boxShadow: "0 4px 24px rgba(0,0,0,0.18)",
            fontWeight: 500,
            fontSize: 14,
            maxWidth: 380,
            display: "flex",
            alignItems: "center",
            gap: 8,
            animation: "fadeInUp 0.3s ease",
          }}
        >
          {toast.message}
          <button
            onClick={() => setToast(null)}
            style={{ background: "none", border: "none", color: "#fff", cursor: "pointer", marginLeft: 8, fontSize: 16, lineHeight: 1 }}
          >
            ×
          </button>
        </div>
      )}
      <div className="statements">
        <div className="statements-main">
          {/* Month Selector Grid */}
          <div className="section-card">
            <div className="month-header">
              <h3 className="section-title">Select Reporting Month</h3>
              <span className="month-hint">Required for automated filing</span>
            </div>
            <div className="month-grid">
              {months.map((m, i) => {
                const stmts = getMonthStatements(i);
                const isProcessed = stmts.some((s) => s.parseStatus === "READY" || s.parseStatus === "ANNOTATED");
                const isProcessing = stmts.some((s) => s.parseStatus === "PROCESSING" || s.parseStatus === "UPLOADED");
                const hasMultiple = stmts.length > 1;
                const isActive = i === selectedMonth;
                // Months 4-12 (index 3-11) are locked for free-tier users
                const isLocked = !activeWorkspace?.isUnlocked && i >= 3;
                return (
                  <button
                    key={m.short}
                    className={`month-cell ${isActive ? "month-cell--active" : ""} ${isProcessed ? "month-cell--done" : ""} ${isProcessing ? "month-cell--processing" : ""} ${isLocked ? "month-cell--locked" : ""}`}
                    onClick={() => {
                      if (isLocked) {
                        setLockedMonthClicked(i);
                        setShowUnlockModal(true);
                      } else {
                        setSelectedMonth(i);
                      }
                    }}
                  >
                    <span className="month-short">{m.short}</span>
                    {isLocked && (
                      <span className="material-symbols-outlined month-lock" style={{ fontSize: 13 }}>lock</span>
                    )}
                    {!isLocked && isProcessed && (
                      <span className="material-symbols-outlined month-check" style={{ fontSize: 14 }}>check_circle</span>
                    )}
                    {!isLocked && isProcessing && (
                      <span className="material-symbols-outlined month-check" style={{ fontSize: 14, color: "var(--te-primary)" }}>sync</span>
                    )}
                    {!isLocked && hasMultiple && (
                      <span className="month-multi-badge">{stmts.length}</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Error Banner */}
          {error && (
            <div className="section-card error-banner">
              <span className="material-symbols-outlined" style={{ fontSize: 18, color: "var(--te-error)" }}>error</span>
              <span>{error}</span>
              <button className="error-dismiss" onClick={() => setError("")}>×</button>
            </div>
          )}

          {/* Upload Zone — Uppy-powered */}
          {(currentMonthStatements.length === 0 || canAddMore) && (
            <StatementUploader
              workspaceId={activeWorkspaceId!}
              month={selectedMonth + 1}
              existingCount={currentMonthStatements.length}
              onUploadComplete={(statement) => {
                setStatements((prev) => [...prev, statement]);
              }}
              onError={(message) => setError(message)}
              onPasswordRequired={() => {
                setShowPasswordModal(true);
              }}
              pdfPassword={pdfPassword}
            />
          )}

          {/* Password Modal */}
          {showPasswordModal && (
            <div className="modal-overlay">
              <div className="modal-card">
                <div className="modal-header">
                  <span className="material-symbols-outlined" style={{ fontSize: 22, color: "var(--te-accent)" }}>lock</span>
                  <h3 className="modal-title">Password Protected PDF</h3>
                </div>
                <p className="modal-desc">This document is password protected. Please enter the password to proceed with the upload.</p>
                <input
                  className="modal-input"
                  type="password"
                  placeholder="Enter PDF password"
                  value={pdfPassword}
                  onChange={(e) => setPdfPassword(e.target.value)}
                  autoFocus
                />
                <div className="modal-actions">
                  <button
                    className="modal-btn-cancel"
                    onClick={() => { setShowPasswordModal(false); setPendingFile(null); setPdfPassword(""); }}
                  >Cancel</button>
                  <button
                    className="modal-btn-confirm"
                    disabled={checkingPassword}
                    onClick={async () => {
                      if (!pdfPassword) { setError("Please enter the PDF password"); return; }
                      if (!pendingFile) return;

                      setCheckingPassword(true);
                      try {
                        const formData = new FormData();
                        formData.append("file", pendingFile);
                        formData.append("password", pdfPassword);

                        const res = await fetch("/api/statements/check", {
                          method: "POST",
                          body: formData
                        });

                        if (!res.ok) throw new Error("Validation service failed");

                        const data = await res.json();
                        if (!data.valid) {
                          setError(data.error || "Incorrect PDF password. Please try again.");
                          setCheckingPassword(false);
                          return;
                        }

                        // Password is correct — close modal; the StatementUploader
                        // will pick up the pdfPassword via its useEffect and resume upload.
                        setShowPasswordModal(false);
                        // NOTE: Do NOT clear pdfPassword here; the uploader needs it.
                      } catch {
                        setError("Failed to verify password. Please try again.");
                      } finally {
                        setCheckingPassword(false);
                      }
                    }}
                  >{checkingPassword ? "Checking..." : "Continue Upload"}</button>
                </div>
              </div>
            </div>
          )}

          {/* Existing Statement Cards */}
          {currentMonthStatements.length > 0 && uploadState === "idle" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {currentMonthStatements.map((stmt) => (
                <div key={stmt.id} className="section-card file-card">
                  <div className="file-info">
                    <span className="material-symbols-outlined file-icon">description</span>
                    <div>
                      <p className="file-name">{stmt.originalFilename}</p>
                      <p className="file-meta">
                        Status: {stmt.parseStatus}
                        {stmt.bankName && ` • ${stmt.bankName}`}
                        {stmt.rowCount && ` • ${stmt.rowCount} transactions`}
                      </p>
                    </div>
                  </div>

                  {(stmt.parseStatus === "PROCESSING" || stmt.parseStatus === "UPLOADED") && (
                    <div className="file-progress" style={{ marginTop: "16px" }}>
                      <span className="file-status-text">Analyzing transactions...</span>
                      <div className="progress-bar">
                        <div className="progress-fill progress-fill--pulse" style={{ width: "100%" }} />
                      </div>
                    </div>
                  )}
                  <button
                    className="delete-btn"
                    onClick={() => handleDelete(stmt.id)}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: 16 }}>delete</span>
                    Delete
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Upsell to add more banks if limit reached */}
          {currentMonthStatements.length > 0 && !canAddMore && uploadState === "idle" && (
            <div className="section-card" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "rgba(35,73,77,0.02)", borderStyle: "dashed", marginTop: "12px" }}>
              <div>
                <h4 style={{ margin: "0 0 4px", fontSize: "14px", fontWeight: 600, color: "var(--te-text)" }}>Need to upload another bank?</h4>
                <p style={{ margin: 0, fontSize: "12px", color: "var(--te-text-muted)" }}>You have reached your limit of {allowedBanks} bank{allowedBanks > 1 ? "s" : ""} per month.</p>
              </div>
              <button
                className="modal-btn-confirm"
                onClick={() => router.push("/settings?tab=billing&action=add_bank")}
                style={{ padding: "8px 16px", background: "var(--te-primary)", color: "#fff", display: "flex", alignItems: "center", gap: "6px" }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>add_circle</span>
                Add Extra Bank Access
              </button>
            </div>
          )}
          {/* Unlock Modal */}
          {showUnlockModal && (
            <div className="modal-overlay">
              <div className="modal-card">
                <div className="modal-header">
                  <span className="material-symbols-outlined" style={{ fontSize: 22, color: "var(--te-accent)" }}>lock_open</span>
                  <h3 className="modal-title">Unlock {lockedMonthClicked !== null ? months[lockedMonthClicked].full : "Month"}</h3>
                </div>
                <p className="modal-desc">This month is locked on the free tier. Choose how you&apos;d like to proceed:</p>
                <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                  <button
                    className="modal-btn-confirm" style={{ width: "100%", padding: "14px", textAlign: "center" }}
                    onClick={() => { setShowUnlockModal(false); router.push("/settings?tab=billing&action=unlock"); }}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: 16, verticalAlign: "middle", marginRight: 6 }}>star</span>
                    Unlock All 12 Months — ₦5,000/year
                  </button>
                  <button
                    className="modal-btn-cancel" style={{ width: "100%", padding: "14px", textAlign: "center" }}
                    onClick={() => { setShowUnlockModal(false); router.push("/settings?tab=billing&action=credits"); }}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: 16, verticalAlign: "middle", marginRight: 6 }}>payments</span>
                    Buy Statement Credits
                  </button>
                </div>
                <button
                  className="modal-btn-cancel" style={{ width: "100%", marginTop: 8 }}
                  onClick={() => setShowUnlockModal(false)}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

        </div>

        {/* Right Sidebar */}
        <div className="statements-aside">
          <div className="section-card">
            <div className="aside-header">
              <h4 className="aside-title">Upload Status</h4>
              <span className="aside-count">{processedCount} / 12 Months</span>
            </div>
            {/* Credits Badge */}
            <div className="credits-badge">
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>token</span>
              <span>{activeWorkspace?.statementCredits ?? 0} credits remaining</span>
            </div>
            <div className="status-list">
              {months.map((m, i) => {
                const stmts = getMonthStatements(i);
                const firstStmt = stmts[0];
                return (
                  <div key={m.short} className="status-item">
                    <div className="status-left">
                      {firstStmt?.parseStatus === "READY" || firstStmt?.parseStatus === "ANNOTATED" ? (
                        <span className="material-symbols-outlined" style={{ fontSize: 18, color: "#059669" }}>check_circle</span>
                      ) : firstStmt?.parseStatus === "PROCESSING" || firstStmt?.parseStatus === "UPLOADED" ? (
                        <span className="material-symbols-outlined status-spin" style={{ fontSize: 18, color: "var(--te-primary)" }}>sync</span>
                      ) : firstStmt?.parseStatus === "ERROR" ? (
                        <span className="material-symbols-outlined" style={{ fontSize: 18, color: "var(--te-error)" }}>error</span>
                      ) : (
                        <span className="material-symbols-outlined" style={{ fontSize: 18, color: "var(--te-text-muted)" }}>radio_button_unchecked</span>
                      )}
                      <div>
                        <p className="status-month">{m.full}{stmts.length > 1 ? ` (${stmts.length})` : ""}</p>
                        <p className="status-note">
                          {firstStmt ? firstStmt.originalFilename : "Not uploaded"}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Trust Badges */}
          <div className="section-card trust-card">
            <div className="trust-item">
              <span className="material-symbols-outlined" style={{ fontSize: 18, color: "var(--te-primary)" }}>lock</span>
              <div>
                <p className="trust-title">Secure & Private</p>
                <p className="trust-desc">Bank-grade 256-bit encryption. Your financial data is never shared.</p>
              </div>
            </div>
            <div className="trust-item">
              <span className="material-symbols-outlined" style={{ fontSize: 18, color: "var(--te-mint)" }}>verified</span>
              <div>
                <p className="trust-title">FIRS Compliant</p>
                <p className="trust-desc">Calculations follow Nigerian FIRS tax laws.</p>
              </div>
            </div>
          </div>
        </div>
      </div>

    </>
  );
}
