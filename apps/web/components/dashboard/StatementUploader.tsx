"use client";

/**
 * StatementUploader — Uppy-powered file upload component for bank statements.
 *
 * Uses @uppy/react Dropzone for drag-and-drop UI and @uppy/aws-s3 for
 * presigned URL uploads directly to S3.  After S3 upload succeeds,
 * the component calls the /api/statements/upload confirm endpoint
 * to create the Statement record and enqueue the parse job.
 *
 * Supports password-protected PDF detection: when a PDF contains an
 * /Encrypt marker, the upload is paused and the parent is notified
 * via the `onPasswordRequired` callback.
 */

import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import Uppy, { type Meta, type Body } from "@uppy/core";
import type { UppyFile } from "@uppy/core";
import AwsS3 from "@uppy/aws-s3";

// Simple file hash using SubtleCrypto
async function hashFile(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

// Check if a PDF file is password-protected by looking for /Encrypt in file
async function isPdfPasswordProtected(file: File): Promise<boolean> {
  if (file.type !== "application/pdf") return false;
  const slice = file.size > 1024 * 1024 ? file.slice(file.size - 1024 * 1024) : file;
  try {
    const text = await slice.text();
    return text.includes("/Encrypt");
  } catch {
    return false;
  }
}

interface StatementUploaderProps {
  workspaceId: string;
  month: number; // 1-indexed
  onUploadComplete: (statement: {
    id: string;
    month: number;
    originalFilename: string;
    parseStatus: string;
  }) => void;
  onError: (message: string) => void;
  existingCount?: number;
  /** Called when a password-protected PDF is detected. Parent should show a modal. */
  onPasswordRequired?: (file: File) => void;
  /** The PDF password provided by the user, set by the parent after the modal. */
  pdfPassword?: string;
}

export function StatementUploader({
  workspaceId,
  month,
  onUploadComplete,
  onError,
  existingCount = 0,
  onPasswordRequired,
  pdfPassword = "",
}: StatementUploaderProps) {
  const s3KeyMapRef = useRef(new Map<string, string>());
  const fileHashMapRef = useRef(new Map<string, string>());
  const pdfPasswordRef = useRef(pdfPassword);
  const onUploadCompleteRef = useRef(onUploadComplete);
  const onErrorRef = useRef(onError);
  const pendingFileRef = useRef<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadingFile, setUploadingFile] = useState<string | null>(null);
  const [uploadStatus, setUploadStatus] = useState<"idle" | "uploading" | "confirming" | "done" | "error">("idle");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Keep refs in sync
  useEffect(() => {
    pdfPasswordRef.current = pdfPassword;
    onUploadCompleteRef.current = onUploadComplete;
    onErrorRef.current = onError;
  }, [pdfPassword, onUploadComplete, onError]);


  const uppy = useMemo(() => {
    const instance = new Uppy({
      id: "statement-uploader",
      restrictions: {
        maxFileSize: 20 * 1024 * 1024, // 20 MB
        maxNumberOfFiles: 1,
        allowedFileTypes: [
          ".pdf",
          ".csv",
          ".xls",
          ".xlsx",
        ],
      },
      autoProceed: true,
    });

    instance.use(AwsS3, {
      shouldUseMultipart: false,

      // Custom uploadPartBytes that doesn't hang when ETag is missing from CORS.
      // The default Uppy implementation does `return;` (never resolves) when
      // ETag is null, permanently freezing the upload. This version resolves
      // with an empty ETag so `upload-success` still fires.
      async uploadPartBytes({ signature: { url, expires, headers, method = 'PUT' }, body, size, onProgress, onComplete, signal }: any) {
        if (!url) throw new Error('Cannot upload to an undefined URL');
        
        return new Promise<Record<string, string>>((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          xhr.open(method, url, true);
          if (headers) {
            Object.keys(headers).forEach((key: string) => {
              xhr.setRequestHeader(key, headers[key]);
            });
          }
          xhr.responseType = 'text';
          if (typeof expires === 'number') {
            xhr.timeout = expires * 1000;
          }

          function onabort() { xhr.abort(); }
          function cleanup() { signal?.removeEventListener('abort', onabort); }
          signal?.addEventListener('abort', onabort);

          xhr.upload.addEventListener('progress', (ev) => onProgress?.(ev));

          xhr.addEventListener('abort', () => {
            cleanup();
            reject(new Error('Upload aborted'));
          });

          xhr.addEventListener('timeout', () => {
            cleanup();
            reject(new Error('Request has expired'));
          });

          xhr.addEventListener('load', () => {
            cleanup();
            if (xhr.status < 200 || xhr.status >= 300) {
              reject(new Error(`Non 2xx response: ${xhr.status}`));
              return;
            }
            onProgress?.({ loaded: size ?? (body as Blob).size, lengthComputable: true });

            // Parse response headers
            const headersMap: Record<string, string> = {};
            for (const line of xhr.getAllResponseHeaders().trim().split(/[\r\n]+/)) {
              const parts = line.split(': ');
              const header = parts.shift()!;
              headersMap[header] = parts.join(': ');
            }

            const etag = headersMap['etag'];
            // If ETag is missing (CORS), resolve anyway with empty string.
            // The default Uppy code does `return;` here which HANGS FOREVER.
            onComplete?.(etag ?? 'unknown');
            resolve({ ...headersMap, ETag: etag ?? 'unknown' });
          });

          xhr.addEventListener('error', () => {
            cleanup();
            reject(new Error('Upload network error'));
          });

          xhr.send(body as Blob);
        });
      },

      async getUploadParameters(file: UppyFile<Meta, Body>) {
        // Hash the file for duplicate detection
        const rawFile = file.data as File;
        let fileHash = "";
        try {
          fileHash = await hashFile(rawFile);
        } catch {
          // Hash failure is non-critical
        }

        // Get presigned URL from our API
        const res = await fetch("/api/statements/upload", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "getUploadUrl",
            workspaceId,
            month,
            filename: file.name,
            mimeType: file.type,
            fileSize: file.size,
            fileHash,
          }),
        });

        if (!res.ok) {
          const errData = await res.json();
          throw new Error(errData.error || "Failed to get upload URL");
        }

        const { uploadUrl, s3Key } = await res.json();

        // Store s3Key and hash for the confirm step
        s3KeyMapRef.current.set(file.id!, s3Key);
        fileHashMapRef.current.set(file.id!, fileHash);

        return {
          method: "PUT" as const,
          url: uploadUrl,
          headers: {
            "Content-Type": file.type || "application/octet-stream",
          },
        };
      },
    } as any); // eslint-disable-line @typescript-eslint/no-explicit-any

    return instance;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceId, month]);

  // Handle upload success — confirm with backend
  const handleUploadSuccess = useCallback(
    async (file: UppyFile<Meta, Body> | undefined) => {
      if (!file) return;
      
      const s3Key = s3KeyMapRef.current.get(file.id!);
      const fileHash = fileHashMapRef.current.get(file.id!) || "";

      setUploadStatus("confirming");

      try {
        const confirmRes = await fetch("/api/statements/upload", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "confirm",
            workspaceId,
            month,
            s3Key,
            originalFilename: file.name,
            mimeType: file.type,
            fileHash,
            pdfPassword: pdfPasswordRef.current || "",
          }),
        });

        if (!confirmRes.ok) {
          const errData = await confirmRes.json();
          throw new Error(errData.error || "Failed to confirm upload");
        }

        const statement = await confirmRes.json();
        setUploadStatus("done");
        onUploadCompleteRef.current({
          id: statement.id,
          month: statement.month,
          originalFilename: file.name!,
          parseStatus: statement.parseStatus,
        });

        // Reset for next upload
        setTimeout(() => {
          uppy.clear();
          setUploadStatus("idle");
          setUploadingFile(null);
          setUploadProgress(0);
        }, 2000);
      } catch (err) {
        setUploadStatus("error");
        const message = err instanceof Error ? err.message : "Upload confirmation failed";
        onErrorRef.current(message);
        setTimeout(() => {
          uppy.clear();
          setUploadStatus("idle");
          setUploadingFile(null);
          setUploadProgress(0);
        }, 3000);
      }
    },
    [workspaceId, month, uppy]
  );

  useEffect(() => {
    const onFileAdded = (file: UppyFile<Meta, Body>) => {
      console.log("[Uppy] file-added:", file.name, file.id);
      setUploadingFile(file.name!);
      setUploadStatus("uploading");
      setUploadProgress(10);
    };

    const onProgress = (progress: number) => {
      console.log("[Uppy] progress:", progress);
      setUploadProgress(Math.max(10, Math.min(90, progress)));
    };

    const onSuccess = (file: UppyFile<Meta, Body> | undefined) => {
      console.log("[Uppy] upload-success:", file?.name, file?.id);
      setUploadProgress(95);
      handleUploadSuccess(file);
    };

    const onUploadError = (_file: UppyFile<Meta, Body> | undefined, error: Error) => {
      console.error("[Uppy] upload-error:", _file?.name, error.message);
      setUploadStatus("error");
      setUploadProgress(0);
      onErrorRef.current(error.message || "Upload failed");
    };

    const onComplete = (result: any) => {
      console.log("[Uppy] complete event:", {
        successful: result?.successful?.length,
        failed: result?.failed?.length,
        successFiles: result?.successful?.map((f: any) => f.name),
        failedFiles: result?.failed?.map((f: any) => ({ name: f.name, error: f.error })),
      });
    };

    const onError = (error: Error) => {
      console.error("[Uppy] error event:", error.message);
    };

    uppy.on("file-added", onFileAdded);
    uppy.on("progress", onProgress);
    uppy.on("upload-success", onSuccess);
    uppy.on("upload-error", onUploadError);
    uppy.on("complete", onComplete);
    uppy.on("error", onError);

    return () => {
      uppy.off("file-added", onFileAdded);
      uppy.off("progress", onProgress);
      uppy.off("upload-success", onSuccess);
      uppy.off("upload-error", onUploadError);
      uppy.off("complete", onComplete);
      uppy.off("error", onError);
    };
  }, [uppy, handleUploadSuccess]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      uppy.clear();
    };
  }, [uppy]);

  /** Add a file to Uppy (after password check passes or is not needed) */
  const addFileToUppy = useCallback((file: File) => {
    try {
      uppy.addFile({
        name: file.name,
        type: file.type,
        data: file,
        source: "Local",
        isRemote: false,
      });
    } catch (err) {
      onErrorRef.current(err instanceof Error ? err.message : "Failed to add file");
    }
  }, [uppy]);

  // When pdfPassword changes from empty to a value, resume pending upload.
  // Uses ref so there are NO stale closure issues with the pending file.
  useEffect(() => {
    if (pdfPassword && pendingFileRef.current) {
      const file = pendingFileRef.current;
      pendingFileRef.current = null;
      addFileToUppy(file);
    }
  }, [pdfPassword, addFileToUppy]);

  /** Process a file: check for password protection, then add to Uppy */
  const processFile = useCallback(async (file: File) => {
    // Check password protection for PDFs
    if (file.type === "application/pdf") {
      const isProtected = await isPdfPasswordProtected(file);
      if (isProtected && onPasswordRequired) {
        // Store file in ref and ask parent for password
        pendingFileRef.current = file;
        onPasswordRequired(file);
        return;
      }
    }
    // Not protected or not a PDF — proceed directly
    addFileToUppy(file);
  }, [addFileToUppy, onPasswordRequired]);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) {
      processFile(file);
    }
  };

  const handleBrowse = () => fileInputRef.current?.click();

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processFile(file);
    }
    e.target.value = "";
  };

  // ─── Idle state: drop zone ─────────────────────────────────
  if (uploadStatus === "idle") {
    return (
      <div className="section-card upload-section">
        <div className="upload-icon-wrap">
          <span className="material-symbols-outlined upload-icon">cloud_upload</span>
        </div>
        <h3 className="upload-title">
          {existingCount === 0 
            ? "Upload Statement" 
            : "Add Another Bank Statement"}
        </h3>
        <p className="upload-desc">
          {existingCount === 0 
            ? "Drag and drop your bank statement here, or click to browse. We support official PDF and CSV exports from all Nigerian banks."
            : "You can upload statements from multiple different banks per month."}
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
          <span className="supported-text">Supports all major Nigerian bank statements</span>
        </div>
      </div>
    );
  }

  // ─── Active upload: progress card ──────────────────────────
  return (
    <div className="section-card file-card">
      <div className="file-info">
        <span className="material-symbols-outlined file-icon">description</span>
        <div>
          <p className="file-name">{uploadingFile}</p>
          <p className="file-meta">
            {uploadStatus === "done" ? "Complete" : uploadStatus === "error" ? "Failed" : uploadStatus === "confirming" ? "Confirming..." : "Uploading..."}
          </p>
        </div>
      </div>
      <div className="file-progress">
        <div className="progress-bar">
          <div
            className={`progress-fill ${uploadStatus === "done" ? "progress-fill--done" : ""} ${uploadStatus === "error" ? "progress-fill--error" : ""}`}
            style={{ width: `${uploadStatus === "done" ? 100 : uploadProgress}%` }}
          />
        </div>
      </div>
    </div>
  );
}
