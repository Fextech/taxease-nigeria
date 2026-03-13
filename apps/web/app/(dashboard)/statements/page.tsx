"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useWorkspace } from "@/components/dashboard/WorkspaceContext";

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

const supportedBanksText = "Supports all major bank statements";

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
  const [dragOver, setDragOver] = useState(false);
  const [statements, setStatements] = useState<StatementInfo[]>([]);
  const [uploadState, setUploadState] = useState<UploadState>("idle");
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [error, setError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Password modal state
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [pdfPassword, setPdfPassword] = useState("");
  const [checkingPassword, setCheckingPassword] = useState(false);

  // ETA tracking
  const [uploadStartTime, setUploadStartTime] = useState<number | null>(null);
  const [etaText, setEtaText] = useState("");

  // Estimate ETA based on progress
  useEffect(() => {
    if (uploadStartTime && uploadProgress > 0 && uploadProgress < 100 && uploadState !== "done" && uploadState !== "error") {
      const elapsed = (Date.now() - uploadStartTime) / 1000;
      const totalEstimate = elapsed / (uploadProgress / 100);
      const remaining = Math.max(0, Math.round(totalEstimate - elapsed));
      setEtaText(remaining > 0 ? `~${remaining}s remaining` : "Almost done...");
    } else {
      setEtaText("");
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

      setUploadFile(file);
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

        // Add to local state
        setStatements((prev) => [
          ...prev.filter((s) => s.month !== selectedMonth + 1),
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
          setUploadFile(null);
          setUploadProgress(0);
        }, 2000);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Upload failed";
        setError(message);
        setUploadState("error");
        setTimeout(() => {
          setUploadState("idle");
          setUploadFile(null);
          setUploadProgress(0);
        }, 3000);
      }
    },
    [selectedMonth, activeWorkspaceId]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFileSelect(file);
    },
    [handleFileSelect]
  );

  const handleBrowse = () => fileInputRef.current?.click();

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFileSelect(file);
    e.target.value = ""; // Reset to allow re-upload of same file
  };

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

  // Get statement for a month
  const getMonthStatement = (monthIndex: number) =>
    statements.find((s) => s.month === monthIndex + 1);

  const processedCount = statements.filter(
    (s) => s.parseStatus === "READY" || s.parseStatus === "ANNOTATED"
  ).length;

  return (
    <>
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
                const stmt = getMonthStatement(i);
                const isProcessed = stmt?.parseStatus === "READY" || stmt?.parseStatus === "ANNOTATED";
                const isProcessing = stmt?.parseStatus === "PROCESSING" || stmt?.parseStatus === "UPLOADED";
                const isActive = i === selectedMonth;
                return (
                  <button
                    key={m.short}
                    className={`month-cell ${isActive ? "month-cell--active" : ""} ${isProcessed ? "month-cell--done" : ""} ${isProcessing ? "month-cell--processing" : ""}`}
                    onClick={() => setSelectedMonth(i)}
                  >
                    <span className="month-short">{m.short}</span>
                    {isProcessed && (
                      <span className="material-symbols-outlined month-check" style={{ fontSize: 14 }}>check_circle</span>
                    )}
                    {isProcessing && (
                      <span className="material-symbols-outlined month-check" style={{ fontSize: 14, color: "var(--te-primary)" }}>sync</span>
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

          {/* Upload Zone */}
          {!getMonthStatement(selectedMonth) && (
            <div className="section-card upload-section">
              <div className="upload-icon-wrap">
                <span className="material-symbols-outlined upload-icon">cloud_upload</span>
              </div>
              <h3 className="upload-title">Upload {months[selectedMonth].full} Statement</h3>
              <p className="upload-desc">
                Drag and drop your bank statement here, or click to browse. We support official PDF and CSV exports from all Nigerian banks.
              </p>
              <div
                className={`drop-zone ${dragOver ? "drop-zone--active" : ""}`}
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
              >
                <div className="drop-zone-buttons">
                  <button className="browse-btn" onClick={handleBrowse}>
                    <span className="material-symbols-outlined" style={{ fontSize: 16 }}>folder_open</span>
                    Browse Files
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,.csv,.xls,.xlsx"
                    onChange={handleInputChange}
                    style={{ display: "none" }}
                  />
                </div>
              </div>
              <div className="supported-banks">
                <span className="material-symbols-outlined" style={{ fontSize: 16, color: "var(--te-mint)" }}>verified</span>
                <span className="supported-text">{supportedBanksText}</span>
              </div>
            </div>
          )}

          {/* Upload Progress Card */}
          {uploadState !== "idle" && uploadFile && (
            <div className="section-card file-card">
              <div className="file-info">
                <span className="material-symbols-outlined file-icon">description</span>
                <div>
                  <p className="file-name">{uploadFile.name}</p>
                  <p className="file-meta">
                    {(uploadFile.size / (1024 * 1024)).toFixed(1)} MB •{" "}
                    {uploadState === "done" ? "Complete" : uploadState === "error" ? "Failed" : "Processing..."}
                  </p>
                </div>
              </div>
              <div className="file-progress">
                <span className="file-status-text">
                  {uploadState === "uploading" && "Uploading to server..."}
                  {uploadState === "confirming" && "Confirming upload..."}
                  {uploadState === "done" && "Upload complete!"}
                  {uploadState === "error" && "Upload failed"}
                  {etaText && uploadState !== "done" && uploadState !== "error" && (
                    <span className="file-eta"> — {etaText}</span>
                  )}
                </span>
                <div className="progress-bar">
                  <div
                    className={`progress-fill ${uploadState === "done" ? "progress-fill--done" : ""} ${uploadState === "error" ? "progress-fill--error" : ""}`}
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
              </div>
            </div>
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

                        // Password is correct, proceed with upload
                        setShowPasswordModal(false);
                        handleFileSelect(pendingFile, true, pdfPassword);
                        setPendingFile(null);
                        setPdfPassword("");
                      } catch (err) {
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

          {/* Existing Statement Card */}
          {getMonthStatement(selectedMonth) && uploadState === "idle" && (
            <div className="section-card file-card">
              <div className="file-info">
                <span className="material-symbols-outlined file-icon">description</span>
                <div>
                  <p className="file-name">{getMonthStatement(selectedMonth)!.originalFilename}</p>
                  <p className="file-meta">
                    Status: {getMonthStatement(selectedMonth)!.parseStatus}
                    {getMonthStatement(selectedMonth)!.rowCount && ` • ${getMonthStatement(selectedMonth)!.rowCount} transactions`}
                  </p>
                </div>
              </div>

              {(getMonthStatement(selectedMonth)!.parseStatus === "PROCESSING" || getMonthStatement(selectedMonth)!.parseStatus === "UPLOADED") && (
                <div className="file-progress" style={{ marginTop: "16px" }}>
                  <span className="file-status-text">Analyzing transactions...</span>
                  <div className="progress-bar">
                    <div className="progress-fill progress-fill--pulse" style={{ width: "100%" }} />
                  </div>
                </div>
              )}
              <button
                className="delete-btn"
                onClick={() => handleDelete(getMonthStatement(selectedMonth)!.id)}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>delete</span>
                Delete
              </button>
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
            <div className="status-list">
              {months.map((m, i) => {
                const stmt = getMonthStatement(i);
                return (
                  <div key={m.short} className="status-item">
                    <div className="status-left">
                      {stmt?.parseStatus === "READY" || stmt?.parseStatus === "ANNOTATED" ? (
                        <span className="material-symbols-outlined" style={{ fontSize: 18, color: "#059669" }}>check_circle</span>
                      ) : stmt?.parseStatus === "PROCESSING" || stmt?.parseStatus === "UPLOADED" ? (
                        <span className="material-symbols-outlined status-spin" style={{ fontSize: 18, color: "var(--te-primary)" }}>sync</span>
                      ) : stmt?.parseStatus === "ERROR" ? (
                        <span className="material-symbols-outlined" style={{ fontSize: 18, color: "var(--te-error)" }}>error</span>
                      ) : (
                        <span className="material-symbols-outlined" style={{ fontSize: 18, color: "var(--te-text-muted)" }}>radio_button_unchecked</span>
                      )}
                      <div>
                        <p className="status-month">{m.full}</p>
                        <p className="status-note">
                          {stmt ? stmt.originalFilename : "Not uploaded"}
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

      <style jsx>{`
        .statements { display: grid; grid-template-columns: 1fr 300px; gap: 28px; }
        .statements-main { display: flex; flex-direction: column; gap: 20px; }
        .statements-aside { display: flex; flex-direction: column; gap: 20px; }

        .section-card {
          background: var(--te-surface);
          border-radius: 12px;
          border: 1px solid rgba(35,73,77,0.05);
          box-shadow: 0 1px 3px rgba(0,0,0,0.04);
          padding: 24px;
        }
        .section-title { font-size: 15px; font-weight: 700; color: var(--te-text); margin: 0; }

        /* Error Banner */
        .error-banner {
          display: flex; align-items: center; gap: 10px;
          background: rgba(239,68,68,0.06); border-color: rgba(239,68,68,0.15);
          color: var(--te-error); font-size: 14px;
        }
        .error-dismiss {
          margin-left: auto; background: none; border: none;
          font-size: 18px; cursor: pointer; color: var(--te-text-muted);
        }

        /* Month Grid */
        .month-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
        .month-hint { font-size: 11px; color: var(--te-text-muted); }
        .month-grid { display: grid; grid-template-columns: repeat(6, 1fr); gap: 10px; }
        .month-cell {
          position: relative; display: flex; flex-direction: column; align-items: center; justify-content: center;
          gap: 4px; padding: 14px 8px; border-radius: 8px;
          border: 1.5px solid var(--te-border); background: var(--te-surface);
          cursor: pointer; font-family: var(--font-sans); transition: all 0.15s;
        }
        .month-cell:hover { border-color: var(--te-primary-light); }
        .month-cell--active { border-color: var(--te-primary); background: rgba(35,73,77,0.04); }
        .month-cell--done { border-color: rgba(16,185,129,0.3); }
        .month-cell--processing { border-color: rgba(35,73,77,0.3); }
        .month-short { font-size: 13px; font-weight: 700; color: var(--te-text); }
        .month-check { color: #059669; }

        /* Upload Zone */
        .upload-section { text-align: center; }
        .upload-icon-wrap {
          width: 56px; height: 56px; border-radius: 14px; background: rgba(35,73,77,0.08);
          display: flex; align-items: center; justify-content: center; margin: 0 auto 16px;
        }
        .upload-icon { font-size: 28px; color: var(--te-primary); }
        .upload-title { font-size: 18px; font-weight: 700; color: var(--te-text); margin: 0 0 8px; }
        .upload-desc { font-size: 13px; color: var(--te-text-muted); max-width: 420px; margin: 0 auto 20px; line-height: 1.6; }

        .drop-zone {
          border: 2px dashed var(--te-border); border-radius: 12px; padding: 24px;
          transition: all 0.2s; margin-bottom: 20px;
        }
        .drop-zone--active { border-color: var(--te-primary); background: rgba(35,73,77,0.03); }
        .drop-zone-buttons { display: flex; justify-content: center; gap: 12px; }
        .browse-btn {
          display: flex; align-items: center; gap: 6px; padding: 10px 20px; border-radius: 8px;
          font-size: 14px; font-weight: 600; cursor: pointer; font-family: var(--font-sans);
          transition: all 0.15s; background: var(--te-primary); color: #fff; border: none;
        }
        .browse-btn:hover { background: var(--te-primary-light); }

        .supported-banks { display: flex; align-items: center; justify-content: center; gap: 8px; }
        .supported-text { font-size: 13px; font-weight: 600; color: var(--te-text-muted); }

        /* File Card */
        .file-card { display: flex; align-items: center; justify-content: space-between; gap: 16px; }
        .file-info { display: flex; align-items: center; gap: 12px; }
        .file-icon { font-size: 24px; color: var(--te-text-muted); }
        .file-name { font-size: 14px; font-weight: 600; color: var(--te-text); margin: 0; }
        .file-meta { font-size: 12px; color: var(--te-text-muted); margin: 2px 0 0; }
        /* Progress Bar */
        .file-progress { display: flex; flex-direction: column; gap: 8px; margin-top: 12px; }
        .file-status-text { font-size: 13px; color: var(--te-text-muted); font-weight: 500; }
        .file-eta { color: var(--te-primary); font-weight: 600; }
        .progress-bar { height: 6px; background: rgba(35,73,77,0.1); border-radius: 4px; overflow: hidden; }
        .progress-fill { height: 100%; background: var(--te-primary); border-radius: 4px; transition: width 0.3s ease; }
        .progress-fill--done { background: var(--te-mint); }
        .progress-fill--error { background: var(--te-error); }
        .progress-fill--pulse {
          background: linear-gradient(90deg, var(--te-primary) 0%, #307a82 50%, var(--te-primary) 100%);
          background-size: 200% 100%;
          animation: pulse-bg 2s infinite linear;
        }

        @keyframes pulse-bg {
          0% { background-position: 100% 0; }
          100% { background-position: -100% 0; }
        }

        .delete-btn {
          display: flex; align-items: center; gap: 4px; padding: 6px 12px; border-radius: 6px;
          font-size: 12px; font-weight: 600; cursor: pointer; font-family: var(--font-sans);
          background: rgba(239,68,68,0.08); color: var(--te-error); border: 1px solid rgba(239,68,68,0.15);
          transition: all 0.15s;
        }
        .delete-btn:hover { background: rgba(239,68,68,0.15); }

        /* Password Modal */
        .modal-overlay {
          position: fixed; inset: 0; background: rgba(0,0,0,0.45); z-index: 100;
          display: flex; align-items: center; justify-content: center;
        }
        .modal-card {
          background: var(--te-surface); border-radius: 16px; padding: 32px;
          max-width: 420px; width: 90%; box-shadow: 0 24px 48px rgba(0,0,0,0.2);
        }
        .modal-header { display: flex; align-items: center; gap: 10px; margin-bottom: 12px; }
        .modal-title { font-size: 18px; font-weight: 700; color: var(--te-text); margin: 0; }
        .modal-desc { font-size: 13px; color: var(--te-text-muted); line-height: 1.6; margin: 0 0 20px; }
        .modal-input {
          width: 100%; padding: 12px 16px; border-radius: 8px; border: 1px solid var(--te-border);
          background: var(--te-surface); font-size: 14px; color: var(--te-text); font-family: var(--font-sans);
          margin-bottom: 20px; outline: none; transition: border-color 0.15s;
        }
        .modal-input:focus { border-color: var(--te-primary); }
        .modal-actions { display: flex; gap: 10px; justify-content: flex-end; }
        .modal-btn-cancel {
          padding: 10px 20px; border-radius: 8px; font-size: 13px; font-weight: 600;
          border: 1px solid var(--te-border); background: var(--te-surface); color: var(--te-text-secondary);
          cursor: pointer; font-family: var(--font-sans); transition: all 0.15s;
        }
        .modal-btn-cancel:hover { background: var(--te-surface-hover); }
        .modal-btn-confirm {
          padding: 10px 20px; border-radius: 8px; font-size: 13px; font-weight: 600;
          border: none; background: var(--te-primary); color: #fff;
          cursor: pointer; font-family: var(--font-sans); transition: all 0.15s;
        }
        .modal-btn-confirm:hover { background: var(--te-primary-light); }

        /* Aside */
        .aside-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
        .aside-title { font-size: 15px; font-weight: 700; color: var(--te-text); margin: 0; }
        .aside-count { font-size: 12px; font-weight: 600; color: var(--te-text-muted); }
        .status-list { display: flex; flex-direction: column; gap: 12px; max-height: 400px; overflow-y: auto; }
        .status-item { display: flex; align-items: center; }
        .status-left { display: flex; align-items: center; gap: 10px; }
        .status-month { font-size: 14px; font-weight: 600; color: var(--te-text); margin: 0; }
        .status-note { font-size: 11px; color: var(--te-text-muted); margin: 1px 0 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 180px; }

        .status-spin { animation: spin 1.5s linear infinite; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }

        /* Trust */
        .trust-card { display: flex; flex-direction: column; gap: 16px; }
        .trust-item { display: flex; gap: 12px; }
        .trust-title { font-size: 13px; font-weight: 700; color: var(--te-text); margin: 0; }
        .trust-desc { font-size: 11px; color: var(--te-text-muted); margin: 2px 0 0; line-height: 1.5; }

        @media (max-width: 900px) {
          .statements { grid-template-columns: 1fr; }
          .month-grid { grid-template-columns: repeat(4, 1fr); }
        }
      `}</style>
    </>
  );
}
