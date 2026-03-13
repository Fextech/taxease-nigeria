"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useWorkspace } from "@/components/dashboard/WorkspaceContext";

type TaxableStatus = "YES" | "NO" | "PARTIAL";
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
  totalTaxableKobo: string;
}

type Tab = "all" | "unannotated" | "completed";

// helper: determine if a transaction row is a debit
function isDebitTxn(t: TransactionRow): boolean {
  return BigInt(t.debitAmount) > 0n;
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
  const [saving, setSaving] = useState(false);

  // Annotation form state
  const [formStatus, setFormStatus] = useState<TaxableStatus>("YES");
  const [formExpenseStatus, setFormExpenseStatus] = useState<ExpenseStatus>("OTHER");
  const [formAmount, setFormAmount] = useState("");
  const [formCategory, setFormCategory] = useState<TaxCategory>("UNCLASSIFIED");
  const [formReason, setFormReason] = useState("");

  // Load workspace
  useEffect(() => {
    if (activeWorkspaceId) {
      loadData(activeWorkspaceId);
    } else {
      setTransactions([]);
      setStats(null);
    }
  }, [activeWorkspaceId]);

  const loadData = useCallback(async (wsId: string) => {
    setLoading(true);
    try {
      const [txRes, statsRes] = await Promise.all([
        fetch("/api/annotations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "list", workspaceId: wsId }),
        }),
        fetch("/api/annotations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "stats", workspaceId: wsId }),
        }),
      ]);

      if (txRes.ok) {
        const txData = await txRes.json();
        setTransactions(Array.isArray(txData) ? txData : []);
      }
      if (statsRes.ok) {
        const statsData = await statsRes.json();
        setStats(statsData);
      }
    } catch {
      // Silent fail
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Moved to the top useEffect that listens to activeWorkspaceId
  }, [loadData]);

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

  const handleSave = async (status: AnnotationStatusType = "COMPLETE") => {
    if (!selectedTxn || !activeWorkspaceId) return;
    setSaving(true);

    const isDebit = isDebitTxn(selectedTxn);
    // For debits: DBE maps to YES (so it is treated as Direct Business Expense), OTHER maps to NO
    const resolvedTaxableStatus = isDebit
      ? (formExpenseStatus === "DBE" ? "YES" : "NO")
      : formStatus;

    try {
      const res = await fetch("/api/annotations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "upsert",
          transactionId: selectedTxn.id,
          taxableStatus: resolvedTaxableStatus,
          taxableAmount: !isDebit && formStatus === "PARTIAL" ? formAmount : undefined,
          taxCategory: isDebit ? "UNCLASSIFIED" : formCategory,
          reason: formReason || undefined,
          isDebit,
          status,
        }),
      });

      if (res.ok) {
        await loadData(activeWorkspaceId);
        // Move to next unannotated transaction
        const nextUnannotated = transactions.find(
          (t) => t.id !== selectedTxn.id && !t.annotation
        );
        if (nextUnannotated) {
          setSelectedTxn(nextUnannotated);
        } else {
          setPanelOpen(false);
        }
      }
    } catch {
      // Error handling
    } finally {
      setSaving(false);
    }
  };

  // Filter transactions based on active tab AND type filter
  const filtered = transactions.filter((t) => {
    // Tab filter
    if (activeTab === "unannotated" && t.annotation?.status === "COMPLETE") return false;
    if (activeTab === "completed" && t.annotation?.status !== "COMPLETE") return false;

    // Credit / Debit type filter
    if (txnTypeFilter === "credit" && isDebitTxn(t)) return false;
    if (txnTypeFilter === "debit" && !isDebitTxn(t)) return false;

    return true;
  });

  const totalCount = stats?.totalTransactions ?? transactions.length;
  const annotatedCount = stats?.annotatedTransactions ?? 0;
  const pendingCount = stats?.pendingReview ?? totalCount;
  const taxLiability = stats?.totalTaxableKobo ?? "0";
  const progressPct = totalCount > 0 ? Math.round((annotatedCount / totalCount) * 100) : 0;

  // Per-month transaction counts
  const monthTxnCounts = MONTHS.map((_, i) =>
    transactions.filter((t) => t.statement.month === i + 1).length
  );

  // Delete all transactions for a specific month
  const handleDeleteMonth = async (monthIndex: number) => {
    const monthName = MONTHS[monthIndex];
    const count = monthTxnCounts[monthIndex];
    if (count === 0) return;
    if (!confirm(`You are about to clear all ${count} transaction entries for ${monthName}. This cannot be undone. Proceed?`)) return;
    if (!activeWorkspaceId) return;

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
        await loadData(activeWorkspaceId);
      }
    } catch {
      // silent
    }
  };

  return (
    <>
      <div className="annotations-page">
        <div className="annotations-main">
          {/* Stat Cards */}
          <div className="anno-stats">
            <div className="anno-stat-card">
              <p className="anno-stat-label">Real-time Tax Liability</p>
              <h3 className="anno-stat-value" style={{ color: "var(--te-primary)" }}>
                {formatKobo(taxLiability)}
              </h3>
              <p className="anno-stat-sub">Estimated from annotated income</p>
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
                    const isTaxable = t.annotation?.taxableStatus === "YES" || t.annotation?.taxableStatus === "PARTIAL";

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
                      {(["YES", "NO", "PARTIAL"] as TaxableStatus[]).map((s) => (
                        <button
                          key={s}
                          className={`anno-option ${formStatus === s ? "anno-option--active" : ""}`}
                          onClick={() => setFormStatus(s)}
                        >
                          {s === "YES" ? "Yes" : s === "NO" ? "No" : "Partial"}
                        </button>
                      ))}
                    </div>
                  </div>

                  {formStatus === "PARTIAL" && (
                    <div className="anno-panel-section">
                      <p className="anno-panel-label">Taxable Amount (kobo)</p>
                      <input
                        className="anno-panel-input"
                        value={formAmount}
                        onChange={(e) => setFormAmount(e.target.value)}
                        placeholder="e.g. 120000000"
                      />
                    </div>
                  )}

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
                disabled={saving}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>check</span>
                {saving ? "Saving..." : "Complete Annotation"}
              </button>
              <div className="anno-panel-actions">
                <button
                  className="anno-secondary-btn"
                  onClick={() => handleSave("IN_PROGRESS")}
                  disabled={saving}
                >
                  Save Draft
                </button>
                <button
                  className="anno-secondary-btn"
                  onClick={() => {
                    const next = transactions.find((t) => t.id !== selectedTxn.id && !t.annotation);
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

      <style jsx>{`
        .annotations-page { display: flex; gap: 24px; }
        .annotations-main { flex: 1; display: flex; flex-direction: column; gap: 20px; min-width: 0; }

        /* Stats */
        .anno-stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; }
        .anno-stat-card {
          background: var(--te-surface); padding: 20px; border-radius: 12px;
          border: 1px solid rgba(35,73,77,0.05); box-shadow: 0 1px 3px rgba(0,0,0,0.04);
        }
        .anno-stat-label { font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.06em; color: var(--te-text-muted); margin: 0 0 4px; }
        .anno-stat-value { font-size: 22px; font-weight: 700; margin: 0; }
        .anno-stat-sub { font-size: 12px; color: var(--te-text-muted); margin: 8px 0 0; }
        .anno-progress-bar { height: 6px; background: var(--te-border-light); border-radius: 3px; overflow: hidden; margin-top: 12px; }
        .anno-progress-fill { height: 100%; background: var(--te-primary); border-radius: 3px; transition: width 0.4s; }

        /* Monthly summary cards */
        .month-cards-row {
          display: grid; grid-template-columns: repeat(12, 1fr); gap: 8px;
        }
        .month-card {
          display: flex; flex-direction: column; align-items: center; gap: 4px;
          padding: 10px 4px; border-radius: 8px;
          background: rgba(16,185,129,0.06); border: 1px solid rgba(16,185,129,0.12);
          position: relative; text-align: center;
        }
        .month-card-name { font-size: 11px; font-weight: 700; color: var(--te-text); }
        .month-card-count { font-size: 10px; color: var(--te-text-muted); }
        .month-card-delete {
          background: none; border: none; cursor: pointer; color: var(--te-text-muted);
          padding: 2px; border-radius: 4px; transition: all 0.15s; line-height: 1;
        }
        .month-card-delete:hover { color: #dc2626; background: rgba(239,68,68,0.08); }

        /* PAYE note */
        .paye-note {
          display: flex; align-items: flex-start; gap: 6px;
          font-size: 11px; color: var(--te-accent); line-height: 1.5;
          background: rgba(240,160,48,0.08); padding: 8px 10px; border-radius: 6px;
          margin-top: -8px;
        }

        /* Enhanced Empty State */
        .anno-empty-state {
          padding: 80px 24px; text-align: center;
          display: flex; flex-direction: column; align-items: center; justify-content: center;
        }
        .anno-empty-icon-wrap {
          width: 64px; height: 64px; border-radius: 16px; background: rgba(35,73,77,0.08);
          display: flex; align-items: center; justify-content: center; margin: 0 auto 20px;
        }
        .anno-empty-icon { font-size: 32px; color: var(--te-primary); }
        .anno-empty-title { font-size: 18px; font-weight: 700; color: var(--te-text); margin: 0 0 8px; }
        .anno-empty-desc { font-size: 14px; color: var(--te-text-muted); max-width: 400px; margin: 0 auto; line-height: 1.6; }

        /* Table */
        .txn-panel {
          background: var(--te-surface); border-radius: 12px;
          border: 1px solid rgba(35,73,77,0.05); box-shadow: 0 1px 3px rgba(0,0,0,0.04);
          overflow: hidden;
        }
        .txn-header-bar {
          display: flex; align-items: center; justify-content: space-between;
          border-bottom: 1px solid rgba(35,73,77,0.05); padding-right: 16px;
        }
        .txn-tabs { display: flex; gap: 0; }
        .txn-tab {
          padding: 14px 20px; font-size: 13px; font-weight: 600; color: var(--te-text-muted);
          background: none; border: none; cursor: pointer; font-family: var(--font-sans);
          border-bottom: 2px solid transparent; transition: all 0.15s;
        }
        .txn-tab:hover { color: var(--te-text); }
        .txn-tab--active { color: var(--te-primary); border-bottom-color: var(--te-primary); }
        .tab-count { font-size: 11px; color: var(--te-text-muted); margin-left: 4px; }

        /* Credit / Debit filter */
        .type-filter { display: flex; gap: 4px; }
        .type-filter-btn {
          padding: 6px 14px; border-radius: 6px; font-size: 12px; font-weight: 600;
          border: 1px solid var(--te-border); background: var(--te-surface); color: var(--te-text-muted);
          cursor: pointer; font-family: var(--font-sans); transition: all 0.15s;
        }
        .type-filter-btn:hover { border-color: var(--te-primary-light); color: var(--te-text); }
        .type-filter-btn--active { background: var(--te-primary); color: #fff; border-color: var(--te-primary); }
        .anno-table { width: 100%; text-align: left; border-collapse: collapse; }
        .anno-table th {
          padding: 12px 16px; font-size: 10px; font-weight: 700; text-transform: uppercase;
          letter-spacing: 0.06em; color: var(--te-text-muted); background: rgba(100,116,139,0.04);
        }
        .anno-table td { padding: 14px 16px; font-size: 13px; border-bottom: 1px solid rgba(35,73,77,0.05); }
        .anno-row { cursor: pointer; transition: background 0.1s; }
        .anno-row:hover { background: var(--te-surface-hover); }
        .anno-row--selected { background: rgba(35,73,77,0.04); }
        .anno-checkbox { accent-color: var(--te-primary); }
        .anno-date { font-size: 12px; font-weight: 500; color: var(--te-text-secondary); }
        .anno-desc { display: block; font-weight: 600; color: var(--te-text); }
        .anno-subdesc { display: block; font-size: 11px; color: var(--te-text-muted); }
        .anno-credit { color: var(--te-primary); font-weight: 700; }
        .anno-debit { color: #dc2626; font-weight: 600; }

        .taxable-toggle {
          width: 36px; height: 20px; border-radius: 10px; background: var(--te-border);
          position: relative; cursor: pointer; transition: background 0.2s;
        }
        .taxable-toggle--on { background: var(--te-primary); }
        .taxable-toggle-dot {
          width: 16px; height: 16px; border-radius: 50%; background: #fff;
          position: absolute; top: 2px; left: 2px; transition: transform 0.2s;
          box-shadow: 0 1px 3px rgba(0,0,0,0.15);
        }
        .taxable-toggle--on .taxable-toggle-dot { transform: translateX(16px); }

        .anno-status { font-size: 10px; font-weight: 700; padding: 4px 8px; border-radius: 4px; }
        .anno-status--unannotated { background: rgba(245,158,11,0.1); color: #b45309; }
        .anno-status--complete { background: rgba(16,185,129,0.1); color: #047857; }
        .anno-status--in_progress { background: rgba(59,130,246,0.1); color: #1d4ed8; }
        .anno-status--flagged { background: rgba(239,68,68,0.1); color: #b91c1c; }

        .status-spin { animation: spin 1.5s linear infinite; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }

        /* Annotation Panel */
        .anno-panel {
          width: 340px; min-width: 340px; background: var(--te-surface);
          border-radius: 12px; border: 1px solid rgba(35,73,77,0.05);
          box-shadow: 0 1px 3px rgba(0,0,0,0.04); overflow: hidden; align-self: flex-start;
          position: sticky; top: calc(var(--te-header-height) + 32px);
        }
        .anno-panel-header {
          display: flex; justify-content: space-between; align-items: center;
          padding: 16px 20px; border-bottom: 1px solid rgba(35,73,77,0.05);
        }
        .anno-panel-title-row { display: flex; align-items: center; gap: 8px; }
        .anno-panel-title { font-size: 15px; font-weight: 700; color: var(--te-text); }
        .anno-panel-close { background: none; border: none; color: var(--te-text-muted); cursor: pointer; }
        .anno-panel-close:hover { color: var(--te-text); }
        .anno-panel-body { padding: 20px; display: flex; flex-direction: column; gap: 20px; }
        .anno-panel-section { display: flex; flex-direction: column; gap: 6px; }
        .anno-panel-label { font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: var(--te-text-muted); margin: 0; }
        .anno-panel-txn-name { font-size: 15px; font-weight: 700; color: var(--te-text); margin: 0; }
        .anno-panel-txn-amount { font-size: 20px; font-weight: 700; color: var(--te-primary); margin: 0; }
        .anno-panel-options { display: flex; gap: 8px; }
        .anno-option {
          flex: 1; padding: 8px; border-radius: 6px; border: 1px solid var(--te-border);
          background: var(--te-surface); font-size: 13px; font-weight: 600; color: var(--te-text-secondary);
          cursor: pointer; font-family: var(--font-sans); transition: all 0.15s;
        }
        .anno-option:hover { border-color: var(--te-primary-light); }
        .anno-option--active { background: var(--te-primary); color: #fff; border-color: var(--te-primary); }

        /* Expense status (debit) buttons — dark red style */
        .expense-option { border-color: rgba(153,27,27,0.25); color: #991b1b; }
        .expense-option:hover { border-color: #991b1b; background: rgba(153,27,27,0.05); }
        .expense-option--active { background: #991b1b; color: #fff; border-color: #991b1b; }

        .dbe-note {
          display: flex; align-items: center; gap: 6px;
          font-size: 11px; color: var(--te-text-muted); margin-top: 8px;
          background: rgba(153,27,27,0.06); padding: 6px 10px; border-radius: 6px;
        }
        .anno-panel-input, .anno-panel-select, .anno-panel-textarea {
          width: 100%; padding: 10px 12px; border-radius: 8px; border: 1px solid var(--te-border);
          background: var(--te-surface); font-size: 14px; color: var(--te-text);
          font-family: var(--font-sans); transition: border-color 0.15s;
        }
        .anno-panel-input:focus, .anno-panel-select:focus, .anno-panel-textarea:focus {
          outline: none; border-color: var(--te-primary);
        }
        .anno-panel-textarea { resize: vertical; }

        .ai-suggest {
          display: flex; align-items: center; gap: 6px; font-size: 11px; font-weight: 500;
          color: var(--te-mint); margin-top: 4px;
        }

        .anno-complete-btn {
          display: flex; align-items: center; justify-content: center; gap: 8px;
          width: 100%; padding: 12px; border-radius: 8px; background: var(--te-primary);
          color: #fff; font-size: 14px; font-weight: 700; border: none;
          cursor: pointer; font-family: var(--font-sans); transition: background 0.15s;
        }
        .anno-complete-btn:hover { background: var(--te-primary-light); }
        .anno-complete-btn:disabled { opacity: 0.6; cursor: not-allowed; }
        .anno-panel-actions { display: flex; gap: 8px; }
        .anno-secondary-btn {
          flex: 1; padding: 10px; border-radius: 8px; border: 1px solid var(--te-border);
          background: var(--te-surface); font-size: 13px; font-weight: 600; color: var(--te-text-secondary);
          cursor: pointer; font-family: var(--font-sans); transition: all 0.15s;
        }
        .anno-secondary-btn:hover { background: var(--te-surface-hover); }
        .anno-secondary-btn:disabled { opacity: 0.6; cursor: not-allowed; }

        @media (max-width: 1024px) {
          .annotations-page { flex-direction: column; }
          .anno-panel { width: 100%; min-width: 0; position: static; }
        }
        @media (max-width: 768px) {
          .anno-stats { grid-template-columns: 1fr; }
        }
      `}</style>
    </>
  );
}
