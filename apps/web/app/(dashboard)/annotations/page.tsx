"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useWorkspace } from "@/components/dashboard/WorkspaceContext";

type TaxableStatus = "YES" | "NO";
type ExpenseStatus = "OTHER" | "DBE"; // maps to NO / YES on the backend
type TaxCategory = "EMPLOYMENT" | "BUSINESS" | "RENTAL" | "INVESTMENT" | "FOREIGN" | "EXEMPT" | "UNCLASSIFIED";
type TxnTypeFilter = "all" | "credit" | "debit";
type AnnotationStatusType = "UNANNOTATED" | "IN_PROGRESS" | "COMPLETE" | "FLAGGED";

interface AnnotationData {
  id: string;
  taxableStatus: TaxableStatus;
  taxableAmount: string | null;
  taxCategory: TaxCategory;
  reason: string | null;
  reliefType: string | null;
  status: AnnotationStatusType;
  notes: string | null;
  aiSuggested: boolean;
  aiConfidence: number | null;
}

interface TransactionRow {
  id: string;
  transactionDate: string;
  description: string;
  creditAmount: string;
  debitAmount: string;
  balance: string | null;
  channel: string | null;
  confidence: number | null;
  statement: { month: number; bankName: string | null };
  annotation: AnnotationData | null;
}

interface Stats {
  totalTransactions: number;
  annotatedTransactions: number;
  pendingReview: number;
  totalIncomeKobo: string;
  totalDBEKobo: string;
  monthCounts: Record<number, number>;
}

type Tab = "all" | "unannotated" | "completed";

const PAGE_SIZE = 50;

// helper: determine if a transaction row is a debit
function isDebitTxn(t: TransactionRow): boolean {
  return BigInt(t.debitAmount) > 0n;
}

function isCompleteAnnotation(annotation: AnnotationData | null): boolean {
  return annotation?.status === "COMPLETE";
}

function isPendingAnnotation(annotation: AnnotationData | null): boolean {
  return !isCompleteAnnotation(annotation);
}

const TAX_CATEGORIES: { value: TaxCategory; label: string }[] = [
  { value: "BUSINESS", label: "Business Income" },
  { value: "EMPLOYMENT", label: "Employment Income" },
  { value: "INVESTMENT", label: "Investment Income" },
  { value: "RENTAL", label: "Rental Income" },
  { value: "FOREIGN", label: "Foreign Income" },
  { value: "EXEMPT", label: "Exempt" },
  { value: "UNCLASSIFIED", label: "Unclassified" },
];

const MONTHS = [
  "JAN","FEB","MAR","APR","MAY","JUN",
  "JUL","AUG","SEP","OCT","NOV","DEC"
];

function formatKobo(koboStr: string): string {
  const naira = Number(koboStr) / 100;
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(naira);
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-NG", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function AnnotationsPage() {
  useSession();
  const { activeWorkspaceId } = useWorkspace();

  const [transactions, setTransactions] = useState<TransactionRow[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>("all");
  const [txnTypeFilter, setTxnTypeFilter] = useState<TxnTypeFilter>("all");
  const [selectedTxn, setSelectedTxn] = useState<TransactionRow | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [pendingSaveIds, setPendingSaveIds] = useState<Record<string, true>>({});
  const [currentPage, setCurrentPage] = useState(1);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const [confirmDeleteMonth, setConfirmDeleteMonth] = useState<number | null>(null); // monthIndex pending delete

  // Annotation form state
  const [formStatus, setFormStatus] = useState<TaxableStatus>("YES");
  const [formExpenseStatus, setFormExpenseStatus] = useState<ExpenseStatus>("OTHER");
  const [formAmount, setFormAmount] = useState("");
  const [formCategory, setFormCategory] = useState<TaxCategory>("UNCLASSIFIED");
  const [formReason, setFormReason] = useState("");

  const loadStats = useCallback(async (wsId: string) => {
    const statsRes = await fetch("/api/annotations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "stats", workspaceId: wsId }),
    });

    if (statsRes.ok) {
      const statsData = await statsRes.json();
      setStats(statsData);
    }
  }, []);

  const loadTransactions = useCallback(async (wsId: string, page: number) => {
    setLoading(true);
    try {
      const txRes = await fetch("/api/annotations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "list", workspaceId: wsId, page, pageSize: PAGE_SIZE }),
      });

      if (txRes.ok) {
        const txData = await txRes.json();
        setTransactions(Array.isArray(txData.items) ? txData.items : []);
      } else {
        setTransactions([]);
      }
    } catch {
      setTransactions([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Load workspace
  useEffect(() => {
    if (activeWorkspaceId) {
      setCurrentPage(1);
      setSelectedTxn(null);
      setPanelOpen(false);
      void loadStats(activeWorkspaceId);
    } else {
      setTransactions([]);
      setStats(null);
    }
  }, [activeWorkspaceId, loadStats]);

  useEffect(() => {
    if (activeWorkspaceId) {
      void loadTransactions(activeWorkspaceId, currentPage);
    }
  }, [activeWorkspaceId, currentPage, loadTransactions]);




  // When selecting a transaction, populate the form
  useEffect(() => {
    if (selectedTxn?.annotation) {
      const ann = selectedTxn.annotation;
      if (isDebitTxn(selectedTxn)) {
        // Map backend taxableStatus back to expense status
        setFormExpenseStatus(ann.taxableStatus === "YES" ? "DBE" : "OTHER");
      } else {
        setFormStatus(ann.taxableStatus);
      }
      setFormAmount(ann.taxableAmount || "");
      setFormCategory(ann.taxCategory);
      setFormReason(ann.reason || "");
    } else {
      setFormStatus("YES");
      setFormExpenseStatus("OTHER");
      setFormAmount("");
      setFormCategory("UNCLASSIFIED");
      setFormReason("");
    }
  }, [selectedTxn]);

  const buildAnnotationPayload = (
    transaction: TransactionRow,
    status: AnnotationStatusType
  ): AnnotationData => {
    const isDebit = isDebitTxn(transaction);
    const taxableStatus = isDebit
      ? (formExpenseStatus === "DBE" ? "YES" : "NO")
      : formStatus;

    return {
      id: transaction.annotation?.id || `optimistic-${transaction.id}`,
      taxableStatus,
      taxableAmount: transaction.annotation?.taxableAmount ?? null,
      taxCategory: isDebit ? "UNCLASSIFIED" : formCategory,
      reason: formReason || null,
      reliefType: transaction.annotation?.reliefType || null,
      status,
      notes: transaction.annotation?.notes || null,
      aiSuggested: transaction.annotation?.aiSuggested || false,
      aiConfidence: transaction.annotation?.aiConfidence || null,
    };
  };

  const getIncomeContribution = (transaction: TransactionRow, annotation: AnnotationData | null) => {
    if (!annotation || !isCompleteAnnotation(annotation) || annotation.taxableStatus !== "YES") {
      return 0n;
    }

    return BigInt(transaction.creditAmount) > 0n ? BigInt(transaction.creditAmount) : 0n;
  };

  const getDBEContribution = (transaction: TransactionRow, annotation: AnnotationData | null) => {
    if (!annotation || !isCompleteAnnotation(annotation) || annotation.taxableStatus !== "YES") {
      return 0n;
    }

    return BigInt(transaction.debitAmount) > 0n ? BigInt(transaction.debitAmount) : 0n;
  };

  const applyOptimisticStats = (
    currentStats: Stats | null,
    transaction: TransactionRow,
    nextAnnotation: AnnotationData
  ) => {
    if (!currentStats) return currentStats;

    const wasComplete = isCompleteAnnotation(transaction.annotation);
    const willBeComplete = isCompleteAnnotation(nextAnnotation);
    const annotatedDelta = !wasComplete && willBeComplete ? 1 : wasComplete && !willBeComplete ? -1 : 0;

    const previousIncome = getIncomeContribution(transaction, transaction.annotation);
    const nextIncome = getIncomeContribution(transaction, nextAnnotation);
    const previousDBE = getDBEContribution(transaction, transaction.annotation);
    const nextDBE = getDBEContribution(transaction, nextAnnotation);

    const nextAnnotatedTransactions = currentStats.annotatedTransactions + annotatedDelta;

    return {
      ...currentStats,
      annotatedTransactions: nextAnnotatedTransactions,
      pendingReview: currentStats.totalTransactions - nextAnnotatedTransactions,
      totalIncomeKobo: (BigInt(currentStats.totalIncomeKobo) - previousIncome + nextIncome).toString(),
      totalDBEKobo: (BigInt(currentStats.totalDBEKobo) - previousDBE + nextDBE).toString(),
    };
  };

  const handleSave = async (status: AnnotationStatusType = "COMPLETE") => {
    if (!selectedTxn || !activeWorkspaceId) return;
    const previousTransactions = transactions;
    const previousStats = stats;
    const previousSelectedTxn = selectedTxn;
    const previousPanelState = panelOpen;
    const optimisticAnnotation = buildAnnotationPayload(selectedTxn, status);
    const isDebit = isDebitTxn(selectedTxn);
    const resolvedTaxableStatus = optimisticAnnotation.taxableStatus;

    const optimisticTransactions = transactions.map((txn) =>
      txn.id === selectedTxn.id
        ? {
            ...txn,
            annotation: optimisticAnnotation,
          }
        : txn
    );

    setTransactions(optimisticTransactions);
    setStats((currentStats) => applyOptimisticStats(currentStats, selectedTxn, optimisticAnnotation));
    setPendingSaveIds((current) => ({ ...current, [selectedTxn.id]: true }));

    const nextUnannotated = optimisticTransactions.find(
      (t) => t.id !== selectedTxn.id && isPendingAnnotation(t.annotation)
    );
    if (nextUnannotated) {
      setSelectedTxn(nextUnannotated);
      setPanelOpen(true);
    } else {
      setSelectedTxn(null);
      setPanelOpen(false);
    }

    try {
      const res = await fetch("/api/annotations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "upsert",
          transactionId: selectedTxn.id,
          taxableStatus: resolvedTaxableStatus,
          taxableAmount: optimisticAnnotation.taxableAmount ?? undefined,
          taxCategory: isDebit ? "UNCLASSIFIED" : formCategory,
          reason: formReason || undefined,
          isDebit,
          status,
        }),
      });

      if (res.ok) {
        const savedAnnotation = await res.json();
        setTransactions((currentTransactions) =>
          currentTransactions.map((txn) =>
            txn.id === previousSelectedTxn.id
            ? {
                ...txn,
                annotation: {
                  id: savedAnnotation.id,
                  taxableStatus: savedAnnotation.taxableStatus,
                  taxableAmount: savedAnnotation.taxableAmount,
                  taxCategory: savedAnnotation.taxCategory,
                  reason: savedAnnotation.reason,
                  reliefType: savedAnnotation.reliefType,
                  status: savedAnnotation.status,
                  notes: savedAnnotation.notes,
                  aiSuggested: savedAnnotation.aiSuggested,
                  aiConfidence: savedAnnotation.aiConfidence,
                },
              }
            : txn
          )
        );
      } else {
        throw new Error("Failed to save annotation");
      }
    } catch {
      setTransactions(previousTransactions);
      setStats(previousStats);
      setSelectedTxn(previousSelectedTxn);
      setPanelOpen(previousPanelState);
    } finally {
      setPendingSaveIds((current) => {
        const next = { ...current };
        delete next[previousSelectedTxn.id];
        return next;
      });
    }
  };

  // Filter transactions based on active tab AND type filter
  const filtered = transactions.filter((t) => {
    // Tab filter
    if (activeTab === "unannotated" && isCompleteAnnotation(t.annotation)) return false;
    if (activeTab === "completed" && !isCompleteAnnotation(t.annotation)) return false;

    // Credit / Debit type filter
    if (txnTypeFilter === "credit" && isDebitTxn(t)) return false;
    if (txnTypeFilter === "debit" && !isDebitTxn(t)) return false;

    return true;
  });

  const totalCount = stats?.totalTransactions ?? transactions.length;
  const annotatedCount = stats?.annotatedTransactions ?? 0;
  const pendingCount = stats?.pendingReview ?? totalCount;
  const totalIncome = stats?.totalIncomeKobo ?? "0";
  const dbeValue = stats?.totalDBEKobo ?? "0";
  const progressPct = totalCount > 0 ? Math.round((annotatedCount / totalCount) * 100) : 0;

  // Per-month transaction counts
  const monthTxnCounts = MONTHS.map((_, i) => stats?.monthCounts?.[i + 1] ?? 0);
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  // Delete all transactions for a specific month
  const handleDeleteMonth = (monthIndex: number) => {
    const count = monthTxnCounts[monthIndex];
    if (count === 0) return;
    setConfirmDeleteMonth(monthIndex);
  };

  const confirmDeleteMonthAction = async () => {
    if (confirmDeleteMonth === null || !activeWorkspaceId) return;
    const monthIndex = confirmDeleteMonth;
    const monthName = MONTHS[monthIndex];
    const count = monthTxnCounts[monthIndex];
    setConfirmDeleteMonth(null);
    try {
      const res = await fetch("/api/annotations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "deleteByMonth",
          workspaceId: activeWorkspaceId,
          month: monthIndex + 1,
        }),
      });
      if (res.ok) {
        setToast({ message: `Cleared ${count} transaction${count !== 1 ? "s" : ""} for ${monthName}.`, type: "success" });
        setTimeout(() => setToast(null), 4000);
        await Promise.all([
          loadTransactions(activeWorkspaceId, currentPage),
          loadStats(activeWorkspaceId),
        ]);
      } else {
        setToast({ message: `Failed to clear ${monthName} transactions. Please try again.`, type: "error" });
        setTimeout(() => setToast(null), 5000);
      }
    } catch {
      setToast({ message: "Something went wrong. Please try again.", type: "error" });
      setTimeout(() => setToast(null), 5000);
    }
  };

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

      {/* Delete Month Confirmation Modal */}
      {confirmDeleteMonth !== null && (
        <div className="modal-overlay">
          <div className="modal-card" style={{ maxWidth: 420 }}>
            <div className="modal-header">
              <span className="material-symbols-outlined" style={{ fontSize: 22, color: "var(--te-error, #ef4444)" }}>delete_sweep</span>
              <h3 className="modal-title">Clear {MONTHS[confirmDeleteMonth]} Transactions</h3>
            </div>
            <p className="modal-desc">
              You are about to clear all <strong>{monthTxnCounts[confirmDeleteMonth]}</strong> transaction entries for <strong>{MONTHS[confirmDeleteMonth]}</strong>. This cannot be undone.
            </p>
            <div className="modal-actions">
              <button className="modal-btn-cancel" onClick={() => setConfirmDeleteMonth(null)}>Cancel</button>
              <button
                className="modal-btn-confirm"
                style={{ background: "var(--te-error, #ef4444)" }}
                onClick={confirmDeleteMonthAction}
              >
                Clear Transactions
              </button>
            </div>
          </div>
        </div>
      )}
      <div className="annotations-page">
        <div className="annotations-main">
          {/* Stat Cards */}
          <div className="anno-stats">
            <div className="anno-stat-card">
              <p className="anno-stat-label">Total Income</p>
              <h3 className="anno-stat-value" style={{ color: "var(--te-primary)" }}>
                {formatKobo(totalIncome)}
              </h3>
              <p className="anno-stat-sub">gross earnings before DBE deduction</p>
            </div>
            <div className="anno-stat-card">
              <p className="anno-stat-label">Direct business expenses</p>
              <h3 className="anno-stat-value" style={{ color: "#ef4444" }}>
                {formatKobo(dbeValue)}
              </h3>
              <p className="anno-stat-sub">deductible business expenses</p>
            </div>
            <div className="anno-stat-card">
              <p className="anno-stat-label">Annotated Transactions</p>
              <h3 className="anno-stat-value" style={{ color: "var(--te-primary)" }}>
                {annotatedCount}/{totalCount}
              </h3>
              <div className="anno-progress-bar">
                <div className="anno-progress-fill" style={{ width: `${progressPct}%` }} />
              </div>
            </div>
            <div className="anno-stat-card">
              <p className="anno-stat-label">Pending Review</p>
              <h3 className="anno-stat-value" style={{ color: "var(--te-accent)" }}>
                {pendingCount}
              </h3>
              <p className="anno-stat-sub">{pendingCount > 0 ? "Priority: High" : "All done!"}</p>
            </div>
          </div>

          {/* Monthly Summary Cards */}
          <div className="month-cards-row">
            {MONTHS.map((m, i) => (
              <div key={m} className="month-card">
                <span className="month-card-name">{m}</span>
                <span className="month-card-count">{monthTxnCounts[i]} txns</span>
                {monthTxnCounts[i] > 0 && (
                  <button
                    className="month-card-delete"
                    onClick={() => handleDeleteMonth(i)}
                    title={`Clear ${m} transactions`}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: 14 }}>delete</span>
                  </button>
                )}
              </div>
            ))}
          </div>

          {/* Transaction Table */}
          <div className="txn-panel">
            <div className="txn-header-bar">
              <div className="txn-tabs">
                {([
                  { key: "all" as Tab, label: "All Transactions", count: totalCount },
                  { key: "unannotated" as Tab, label: "Unannotated", count: pendingCount },
                  { key: "completed" as Tab, label: "Completed", count: annotatedCount },
                ]).map((t) => (
                  <button
                    key={t.key}
                    className={`txn-tab ${activeTab === t.key ? "txn-tab--active" : ""}`}
                    onClick={() => setActiveTab(t.key)}
                  >
                    {t.label} <span className="tab-count">{t.count}</span>
                  </button>
                ))}
              </div>

              {/* Credit / Debit filter */}
              <div className="type-filter">
                {(["all", "credit", "debit"] as TxnTypeFilter[]).map((f) => (
                  <button
                    key={f}
                    className={`type-filter-btn ${txnTypeFilter === f ? "type-filter-btn--active" : ""}`}
                    onClick={() => setTxnTypeFilter(f)}
                  >
                    {f === "all" ? "All" : f === "credit" ? "Credit" : "Debit"}
                  </button>
                ))}
              </div>
            </div>
            <div className="txn-list">
              {!activeWorkspaceId ? (
                <div className="anno-empty-state">
                  <div className="anno-empty-icon-wrap">
                    <span className="material-symbols-outlined anno-empty-icon">event_note</span>
                  </div>
                  <h3 className="anno-empty-title">Select a Tax Year</h3>
                  <p className="anno-empty-desc">Please select or create a Tax Year to view transactions.</p>
                </div>
              ) : loading ? (
                <div className="anno-empty-state">
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
                    <span
                      className="material-symbols-outlined status-spin"
                      style={{ fontSize: 40, color: "var(--te-primary)" }}
                    >
                      progress_activity
                    </span>
                    <p className="anno-empty-desc" style={{ margin: 0 }}>Loading transactions…</p>
                  </div>
                </div>
              ) : filtered.length === 0 ? (
                <div className="anno-empty-state">
                  <div className="anno-empty-icon-wrap">
                    <span className="material-symbols-outlined anno-empty-icon">inbox</span>
                  </div>
                  <h3 className="anno-empty-title">No Transactions</h3>
                  <p className="anno-empty-desc">
                    {activeTab === "all" ? "No transactions found. Upload a statement first to start annotating." : `No ${activeTab} transactions found.`}
                  </p>
                </div>
              ) : (
                <>
                  <table className="anno-table">
                    <thead>
                      <tr>
                        <th style={{ width: 32 }}></th>
                        <th>Date</th>
                        <th>Description</th>
                        <th>Credit/Debit</th>
                        <th>Taxable?</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map((t) => {
                        const isCredit = BigInt(t.creditAmount) > 0n;
                        const amount = isCredit ? t.creditAmount : t.debitAmount;
                        const annStatus = t.annotation?.status || "UNANNOTATED";
                        const isTaxable = t.annotation?.taxableStatus === "YES";

                        return (
                          <tr
                            key={t.id}
                            className={`anno-row ${selectedTxn?.id === t.id ? "anno-row--selected" : ""}`}
                            onClick={() => { setSelectedTxn(t); setPanelOpen(true); }}
                          >
                            <td>
                              <input type="checkbox" className="anno-checkbox" readOnly checked={selectedTxn?.id === t.id} />
                            </td>
                            <td className="anno-date">{formatDate(t.transactionDate)}</td>
                            <td>
                              <span className="anno-desc">{t.description}</span>
                              {t.channel && <span className="anno-subdesc">{t.channel}</span>}
                            </td>
                            <td className={isCredit ? "anno-credit" : "anno-debit"}>
                              {isCredit ? "" : "-"}{formatKobo(amount)}
                            </td>
                            <td>
                              <div className={`taxable-toggle ${isTaxable ? "taxable-toggle--on" : ""}`}>
                                <div className="taxable-toggle-dot" />
                              </div>
                            </td>
                            <td>
                              <span className={`anno-status anno-status--${annStatus.toLowerCase()}`}>{annStatus}</span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  {totalPages > 1 && (
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 18px", borderTop: "1px solid rgba(15, 23, 42, 0.08)" }}>
                      <span style={{ fontSize: 13, color: "var(--te-text-muted)" }}>
                        Page {currentPage} of {totalPages}
                      </span>
                      <div style={{ display: "flex", gap: 8 }}>
                        <button
                          className="anno-secondary-btn"
                          disabled={currentPage === 1 || loading}
                          onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                        >
                          Previous
                        </button>
                        <button
                          className="anno-secondary-btn"
                          disabled={currentPage >= totalPages || loading}
                          onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
                        >
                          Next
                        </button>
                      </div>
                    </div>
                  )}
                </>
            )}
            </div>
          </div>
        </div>

        {/* Annotation Panel */}
        {panelOpen && selectedTxn && (
          <div className="anno-panel">
            <div className="anno-panel-header">
              <div className="anno-panel-title-row">
                <span className="material-symbols-outlined" style={{ fontSize: 20 }}>edit_note</span>
                <span className="anno-panel-title">Annotation Panel</span>
              </div>
              <button className="anno-panel-close" onClick={() => setPanelOpen(false)}>
                <span className="material-symbols-outlined" style={{ fontSize: 20 }}>close</span>
              </button>
            </div>

            <div className="anno-panel-body">
              <div className="anno-panel-section">
                <p className="anno-panel-label">Selected Item</p>
                <p className="anno-panel-txn-name">{selectedTxn.description}</p>
                <p className="anno-panel-txn-amount">
                  {formatKobo(BigInt(selectedTxn.creditAmount) > 0n ? selectedTxn.creditAmount : selectedTxn.debitAmount)}
                </p>
              </div>

              {/* Debit → Expense Status | Credit → Taxable Status */}
              {selectedTxn && isDebitTxn(selectedTxn) ? (
                <>
                  <div className="anno-panel-section">
                    <p className="anno-panel-label">Expense Status</p>
                    <div className="anno-panel-options">
                      {(["OTHER", "DBE"] as ExpenseStatus[]).map((s) => (
                        <button
                          key={s}
                          className={`anno-option expense-option ${formExpenseStatus === s ? "expense-option--active" : ""}`}
                          onClick={() => setFormExpenseStatus(s)}
                        >
                          {s === "OTHER" ? "Other Expenses" : "Direct Business Expense"}
                        </button>
                      ))}
                    </div>
                    <p className="dbe-note">
                      <span className="material-symbols-outlined" style={{ fontSize: 14 }}>info</span>
                      DBE are expenses directly incurred on a project
                    </p>
                  </div>
                  {/* Tax Category hidden for debit entries */}
                </>
              ) : (
                <>
                  <div className="anno-panel-section">
                    <p className="anno-panel-label">Taxable Status</p>
                    <div className="anno-panel-options">
                      {(["YES", "NO"] as TaxableStatus[]).map((s) => (
                        <button
                          key={s}
                          className={`anno-option ${formStatus === s ? "anno-option--active" : ""}`}
                          onClick={() => setFormStatus(s)}
                        >
                          {s === "YES" ? "Yes" : "No"}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="anno-panel-section">
                    <p className="anno-panel-label">Tax Category</p>
                    <select
                      className="anno-panel-select"
                      value={formCategory}
                      onChange={(e) => setFormCategory(e.target.value as TaxCategory)}
                    >
                      {TAX_CATEGORIES.map((c) => (
                        <option key={c.value} value={c.value}>{c.label}</option>
                      ))}
                    </select>
                    {selectedTxn?.annotation?.aiSuggested && selectedTxn.annotation.aiConfidence && (
                      <div className="ai-suggest">
                        <span className="material-symbols-outlined" style={{ fontSize: 14 }}>auto_awesome</span>
                        <span>AI Recommendation: {selectedTxn.annotation.taxCategory} ({Math.round(selectedTxn.annotation.aiConfidence * 100)}%)</span>
                      </div>
                    )}
                  </div>
                </>
              )}

              {/* Employment Income PAYE note */}
              {!isDebitTxn(selectedTxn) && formCategory === "EMPLOYMENT" && (
                <div className="paye-note">
                  <span className="material-symbols-outlined" style={{ fontSize: 14 }}>info</span>
                  If your employer has already removed PAYE, please select &quot;No&quot; in the taxable status.
                </div>
              )}

              <div className="anno-panel-section">
                <p className="anno-panel-label">Reason / Justification</p>
                <textarea
                  className="anno-panel-textarea"
                  value={formReason}
                  onChange={(e) => setFormReason(e.target.value)}
                  placeholder="Provide a brief explanation for this tax categorization..."
                  rows={3}
                />
              </div>

              <button
                className="anno-complete-btn"
                onClick={() => handleSave("COMPLETE")}
                disabled={!!(selectedTxn && pendingSaveIds[selectedTxn.id])}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>check</span>
                {selectedTxn && pendingSaveIds[selectedTxn.id] ? "Saving..." : "Complete Annotation"}
              </button>
              <div className="anno-panel-actions" style={{ justifyContent: "center" }}>
                <button
                    className="anno-secondary-btn"
                    style={{ flex: "none", width: "146px" }}
                    onClick={() => {
                    const next = transactions.find((t) => t.id !== selectedTxn.id && isPendingAnnotation(t.annotation));
                    if (next) setSelectedTxn(next);
                    else setPanelOpen(false);
                  }}
                >
                  Skip
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

    </>
  );
}
