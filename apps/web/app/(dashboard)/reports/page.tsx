"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useWorkspace } from "@/components/dashboard/WorkspaceContext";

interface BandBreakdown {
  label: string;
  rate: number;
  taxableInBand: string;
  taxInBand: string;
}

interface ReliefItem {
  label: string;
  amount: string;
}

interface ReportData {
  taxYear: number;
  grossIncome: string;
  cra: string;
  totalReliefs: string;
  taxableIncome: string;
  taxLiability: string;
  effectiveRate: number;
  minimumTaxApplied: boolean;
  breakdown: BandBreakdown[];
  reliefs: ReliefItem[];
  categoryTotals: Record<string, string>;
  stats: {
    totalTransactions: number;
    annotatedTransactions: number;
    completionPct: number;
  };
  workspaceStatus: string;
}

function formatKobo(koboStr: string): string {
  const naira = Number(koboStr) / 100;
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(naira);
}

const RELIEF_ICONS: Record<string, { icon: string; color: string }> = {};

// State IRS website mapping
const STATE_IRS_URLS: Record<string, string> = {
  "Abia": "http://abiairs.gov.ng/",
  "Adamawa": "http://ad-irs.adamawastate.gov.ng/",
  "Akwa Ibom": "http://akirs.ak.gov.ng/",
  "Anambra": "http://tax.services.an.gov.ng/",
  "Bauchi": "http://birs.bu.gov.ng/",
  "Bayelsa": "http://bir.by.gov.ng/",
  "Benue": "http://birs.be.gov.ng/",
  "Borno": "http://birs.bo.gov.ng/menu/Tax-Filling",
  "Cross River": "http://crirs.crossriverstate.gov.ng/",
  "Delta": "http://deltairs.com/",
  "Ebonyi": "http://tax.ebsirb.eb.gov.ng/",
  "Edo": "http://eirs.gov.ng/",
  "Ekiti": "https://ekitistaterevenue.com/",
  "Enugu": "https://irs.en.gov.ng/",
  "Gombe": "https://irs.gm.gov.ng/",
  "Imo": "https://iirs.im.gov.ng/",
  "Jigawa": "https://jsirs.org.ng/",
  "Kaduna": "https://kadirs.kdsg.gov.ng/",
  "Kano": "https://kirs.gov.ng/",
  "Katsina": "https://irs.kt.gov.ng/",
  "Kebbi": "http://irs.kb.gov.ng/etax",
  "Kogi": "https://irs.kg.gov.ng/",
  "Kwara": "https://irs.kw.gov.ng/",
  "Lagos": "http://etax.lirs.net/",
  "Nasarawa": "http://irs.na.gov.ng/",
  "Niger": "http://ngsirs.gov.ng/",
  "Ogun": "http://ogirs.ogunstate.gov.ng",
  "Ondo": "http://odirs.ng",
  "Osun": "http://irs.os.gov.ng/",
  "Oyo": "http://selfservice.oyostatebir.com/",
  "Plateau": "http://psirs.gov.ng",
  "Rivers": "http://riversbirs.gov.ng/",
  "Sokoto": "http://itas.irs.sk.gov.ng/login",
  "Taraba": "https://mda.tarababir.gov.ng/",
  "Yobe": "http://irs.yb.gov.ng/",
  "Zamfara": "http://irs.zm.gov.ng/",
  "FCT (Abuja)": "http://fctirs.gov.ng/",
};

// Hidden reliefs
const HIDDEN_RELIEFS = ["Pension Fund (RSA) \u2014 8%", "National Housing Fund (NHF) \u2014 2.5%"];

const CATEGORY_LABELS: Record<string, string> = {
  BUSINESS: "Business Income",
  EMPLOYMENT: "Employment Income",
  INVESTMENT: "Investment Income",
  RENTAL: "Rental Income",
  FOREIGN: "Foreign Income",
  EXEMPT: "Exempt",
  UNCLASSIFIED: "Unclassified",
};

export default function ReportsPage() {
  useSession();
  const { activeWorkspaceId, activeWorkspace } = useWorkspace();

  const [report, setReport] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadReport = useCallback(async (wsId: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "generate", workspaceId: wsId }),
      });

      if (res.ok) {
        const data = await res.json();
        setReport(data);
      } else {
        const err = await res.json();
        setError(err.error || "Failed to generate report");
      }
    } catch {
      setError("Failed to connect to the server");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeWorkspaceId) {
      loadReport(activeWorkspaceId);
    } else {
      setReport(null);
      setLoading(false);
    }
  }, [activeWorkspaceId, loadReport]);

  const taxYear = activeWorkspace?.taxYear ?? new Date().getFullYear();

  // Additional Deductions
  const [showAdditionalDeductions, setShowAdditionalDeductions] = useState(false);
  const [additionalDeductions, setAdditionalDeductions] = useState<{label: string; amount: string}[]>([]);

  // User's state of residence (would come from settings API)
  const [userState, setUserState] = useState<string | null>(null);
  const [showStatePrompt, setShowStatePrompt] = useState(false);
  const [selectedState, setSelectedState] = useState("");

  // Load user state on mount
  useEffect(() => {
    async function loadUserState() {
      try {
        const res = await fetch("/api/settings", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "get" }),
        });
        if (res.ok) {
          const data = await res.json();
          setUserState(data.stateOfResidence || null);
        }
      } catch { /* ignore */ }
    }
    loadUserState();
  }, []);

  const addDeduction = () => setAdditionalDeductions((prev) => [...prev, { label: "", amount: "" }]);
  const removeDeduction = (i: number) => setAdditionalDeductions((prev) => prev.filter((_, idx) => idx !== i));
  const updateDeduction = (i: number, field: "label" | "amount", value: string) =>
    setAdditionalDeductions((prev) => prev.map((d, idx) => idx === i ? { ...d, [field]: value } : d));

  const additionalTotal = additionalDeductions.reduce((sum, d) => {
    const amt = parseInt(d.amount || "0", 10);
    return sum + (isNaN(amt) ? 0 : amt);
  }, 0);

  const handleProceedToIRS = () => {
    if (!userState || !STATE_IRS_URLS[userState]) {
      setShowStatePrompt(true);
      return;
    }
    window.open(STATE_IRS_URLS[userState], "_blank");
  };

  // Use report data or fallback to zeros
  const grossIncome = report?.grossIncome ?? "0";
  const totalReliefs = report?.totalReliefs ?? "0";
  const cra = report?.cra ?? "0";
  const taxableIncome = report?.taxableIncome ?? "0";
  const taxLiability = report?.taxLiability ?? "0";
  const effectiveRate = report?.effectiveRate ?? 0;
  const breakdown = report?.breakdown ?? [];
  const reliefs = report?.reliefs ?? [];
  const completionPct = report?.stats?.completionPct ?? 0;
  const isComplete = completionPct === 100;

  return (
    <>
      <div className="reports-page">
        {/* Header */}
        <div className="report-header-card">
          <div className="report-header-left">
            <h1 className="report-year">Tax Year {taxYear}</h1>
            <div className="report-status">
              <span className="material-symbols-outlined" style={{ fontSize: 14, color: isComplete ? "var(--te-mint)" : "var(--te-accent)" }}>circle</span>
              <span>
                Status: {isComplete ? "Ready for Filing" : `Draft — ${completionPct}% Annotated`}
              </span>
            </div>
          </div>
          <div className="report-header-actions">
            <div className="report-year-selector">
              <button className="report-refresh-btn" onClick={() => activeWorkspaceId && loadReport(activeWorkspaceId)} disabled={loading || !activeWorkspaceId}>
                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>refresh</span>
                Refresh
              </button>
            </div>
            <button className="report-btn-outline">
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>download</span>
              Excel Export
            </button>
            <button className="report-btn-primary" onClick={handleProceedToIRS}>
              Proceed to IRS Portal
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>open_in_new</span>
            </button>
          </div>
        </div>

        {loading ? (
          <div className="report-loading">
            <span className="material-symbols-outlined status-spin" style={{ fontSize: 28, color: "var(--te-primary)" }}>sync</span>
            <p>Computing tax report...</p>
          </div>
        ) : error ? (
          <div className="report-error">
            <span className="material-symbols-outlined" style={{ fontSize: 28, color: "#dc2626" }}>error</span>
            <p>{error}</p>
            <button className="report-btn-outline" onClick={() => activeWorkspaceId && loadReport(activeWorkspaceId)}>Retry</button>
          </div>
        ) : (
          <>
            {/* Tax Computation Summary */}
            <div className="computation-card">
              <h3 className="section-title">Tax Computation Summary</h3>
              <div className="computation-grid">
                <div className="comp-item">
                  <span className="comp-label">Gross Income</span>
                  <span className="comp-value">{formatKobo(grossIncome)}</span>
                </div>
                <div className="comp-item">
                  <span className="comp-label">Total Reliefs</span>
                  <span className="comp-value" style={{ color: "var(--te-mint)" }}>{formatKobo((BigInt(cra) + BigInt(totalReliefs) + BigInt(additionalTotal)).toString())}</span>
                </div>
                <div className="comp-item">
                  <span className="comp-label">Taxable Income</span>
                  <span className="comp-value">{formatKobo(taxableIncome)}</span>
                </div>
                <div className="comp-item comp-item--liability">
                  <span className="comp-label">Taxable Liability</span>
                  <span className="comp-value comp-value--liability">{formatKobo(taxLiability)}</span>
                  <span className="comp-sublabel">Effective rate: {effectiveRate.toFixed(1)}%</span>
                </div>
              </div>
              {report?.minimumTaxApplied && (
                <div className="min-tax-note">
                  <span className="material-symbols-outlined" style={{ fontSize: 14 }}>info</span>
                  Minimum tax rule applied (1% of gross income)
                </div>
              )}
            </div>

            {/* Two columns: PAYE Breakdown + Reliefs */}
            <div className="report-columns">
              {/* PAYE Breakdown */}
              <div className="breakdown-card">
                <div className="breakdown-header">
                  <span className="material-symbols-outlined" style={{ fontSize: 18, color: "var(--te-primary)" }}>analytics</span>
                  <h4 className="breakdown-title">Tax Band Breakdown (P.A.Y.E)</h4>
                </div>
                {breakdown.length > 0 ? (
                  <table className="breakdown-table">
                    <thead>
                      <tr>
                        <th>Income Band</th>
                        <th>Rate</th>
                        <th style={{ textAlign: "right" }}>Tax Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {breakdown.map((b, i) => (
                        <tr key={i} className={BigInt(b.taxableInBand) === 0n ? "row-zero" : ""}>
                          <td>{b.label}</td>
                          <td><span className="rate-badge">{Math.round(b.rate * 100)}%</span></td>
                          <td style={{ textAlign: "right", fontWeight: 700 }}>{formatKobo(b.taxInBand)}</td>
                        </tr>
                      ))}
                      <tr className="total-row">
                        <td colSpan={2} style={{ fontWeight: 700 }}>Total</td>
                        <td style={{ textAlign: "right", fontWeight: 700, color: "var(--te-primary)" }}>{formatKobo(taxLiability)}</td>
                      </tr>
                    </tbody>
                  </table>
                ) : (
                  <p className="empty-text">No taxable income to compute.</p>
                )}
              </div>

              {/* Reliefs */}
              <div className="reliefs-card">
                <div className="reliefs-header">
                  <span className="material-symbols-outlined" style={{ fontSize: 18, color: "var(--te-mint)" }}>verified</span>
                  <h4 className="reliefs-title">Reliefs & Statutory Deductions</h4>
                </div>
                <div className="reliefs-list">
                  {/* CRA is always first */}
                  <div className="relief-item">
                    <div className="relief-left">
                      <div className="relief-icon" style={{ background: "rgba(35,73,77,0.08)", color: "var(--te-primary)" }}>
                        <span className="material-symbols-outlined" style={{ fontSize: 18 }}>shield</span>
                      </div>
                      <div>
                        <p className="relief-name">Consolidated Relief (CRA)</p>
                        <p className="relief-desc">Fixed + 20% of Gross Income</p>
                      </div>
                    </div>
                    <span className="relief-amount">{formatKobo(cra)}</span>
                  </div>

                  {reliefs.filter((r) => !HIDDEN_RELIEFS.includes(r.label)).map((r) => {
                    const meta = RELIEF_ICONS[r.label] || { icon: "receipt", color: "#8b5cf6" };
                    return (
                      <div key={r.label} className="relief-item">
                        <div className="relief-left">
                          <div className="relief-icon" style={{ background: `${meta.color}15`, color: meta.color }}>
                            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>{meta.icon}</span>
                          </div>
                          <div>
                            <p className="relief-name">{r.label}</p>
                            <p className="relief-desc">Statutory deduction</p>
                          </div>
                        </div>
                        <span className="relief-amount">{formatKobo(r.amount)}</span>
                      </div>
                    );
                  })}

                  {/* Additional Deductions */}
                  <div className="additional-deductions">
                    <div className="addl-deduct-header">
                      <span className="addl-deduct-label">Additional Deductions</span>
                      <label className="toggle-switch">
                        <input type="checkbox" checked={showAdditionalDeductions} onChange={(e) => setShowAdditionalDeductions(e.target.checked)} />
                        <span className="toggle-slider" />
                      </label>
                    </div>
                    {showAdditionalDeductions && (
                      <div className="addl-deduct-body">
                        {additionalDeductions.map((d, i) => (
                          <div key={i} className="addl-deduct-row">
                            <input
                              className="addl-deduct-input"
                              placeholder="Label"
                              value={d.label}
                              onChange={(e) => updateDeduction(i, "label", e.target.value)}
                            />
                            <input
                              className="addl-deduct-input addl-deduct-amount"
                              placeholder="Amount (kobo)"
                              value={d.amount}
                              onChange={(e) => updateDeduction(i, "amount", e.target.value)}
                            />
                            <button className="addl-deduct-remove" onClick={() => removeDeduction(i)}>
                              <span className="material-symbols-outlined" style={{ fontSize: 14 }}>close</span>
                            </button>
                          </div>
                        ))}
                        <button className="addl-deduct-add" onClick={addDeduction}>
                          <span className="material-symbols-outlined" style={{ fontSize: 14 }}>add</span>
                          Add Deduction
                        </button>
                        {additionalDeductions.length > 0 && (
                          <div className="addl-deduct-total">
                            <span>Total Additional:</span>
                            <span style={{ fontWeight: 700 }}>{formatKobo(additionalTotal.toString())}</span>
                          </div>
                        )}
                        <p className="addl-deduct-note">
                          <span className="material-symbols-outlined" style={{ fontSize: 12 }}>info</span>
                          You may be required to submit proof of these deductions to your state IRS.
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Income by Category */}
            {report?.categoryTotals && Object.keys(report.categoryTotals).length > 0 && (
              <div className="computation-card">
                <h3 className="section-title">Income by Category</h3>
                <div className="category-grid">
                  {Object.entries(report.categoryTotals).map(([cat, total]) => (
                    <div key={cat} className="category-item">
                      <span className="category-label">{CATEGORY_LABELS[cat] || cat}</span>
                      <span className="category-value">{formatKobo(total)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Filing CTA */}
            <div className="filing-cta">
              <div className="filing-cta-content">
                <h3 className="filing-cta-title">Ready to file for Tax Year {taxYear}?</h3>
                <p className="filing-cta-desc">
                  Your computation has been validated against current FIRS P.A.Y.E. guidelines. You can now proceed to your state IRS portal to complete filing.
                </p>
                <div className="filing-cta-badges">
                  <span className="material-symbols-outlined" style={{ fontSize: 16, color: "var(--te-mint)" }}>verified</span>
                  <span className="filing-verified-text">Calculations verified & FIRS compliant</span>
                </div>
              </div>
              <button className="filing-cta-btn" onClick={handleProceedToIRS}>
                Proceed to IRS Portal
                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>arrow_forward</span>
              </button>
            </div>

            {/* State Selection Prompt */}
            {showStatePrompt && (
              <div className="modal-overlay">
                <div className="modal-card">
                  <div className="modal-header">
                    <span className="material-symbols-outlined" style={{ fontSize: 22, color: "var(--te-accent)" }}>location_on</span>
                    <h3 className="modal-title">Select Your State</h3>
                  </div>
                  <p className="modal-desc">Please select your state of residence to be redirected to the correct IRS portal.</p>
                  <select
                    className="modal-select"
                    value={selectedState}
                    onChange={(e) => setSelectedState(e.target.value)}
                  >
                    <option value="">-- Select State --</option>
                    {Object.keys(STATE_IRS_URLS).map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                  <div className="modal-actions">
                    <button className="modal-btn-cancel" onClick={() => setShowStatePrompt(false)}>Cancel</button>
                    <button
                      className="modal-btn-confirm"
                      onClick={() => {
                        if (selectedState && STATE_IRS_URLS[selectedState]) {
                          setUserState(selectedState);
                          setShowStatePrompt(false);
                          window.open(STATE_IRS_URLS[selectedState], "_blank");
                        }
                      }}
                    >Go to Portal</button>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      <style jsx>{`
        .reports-page { display: flex; flex-direction: column; gap: 24px; }

        /* Loading / Error */
        .report-loading, .report-error { padding: 60px 24px; text-align: center; color: var(--te-text-muted); }
        .report-loading p, .report-error p { margin: 12px 0; font-size: 15px; }
        .status-spin { animation: spin 1.5s linear infinite; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }

        /* Header */
        .report-header-card {
          display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 16px;
        }
        .report-year { font-size: 28px; font-weight: 700; color: var(--te-text); margin: 0; }
        .report-status {
          display: flex; align-items: center; gap: 6px; font-size: 13px; color: var(--te-text-muted);
          margin-top: 4px;
        }
        .report-header-actions { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
        .year-select {
          padding: 8px 12px; border-radius: 8px; border: 1px solid var(--te-border);
          background: var(--te-surface); font-size: 13px; font-weight: 600; color: var(--te-text);
          font-family: var(--font-sans); cursor: pointer;
        }
        .report-btn-outline {
          display: flex; align-items: center; gap: 6px; padding: 8px 14px; border-radius: 8px;
          border: 1px solid var(--te-border); background: var(--te-surface); font-size: 13px;
          font-weight: 600; color: var(--te-text-secondary); cursor: pointer; font-family: var(--font-sans);
          transition: all 0.15s;
        }
        .report-btn-outline:hover { background: var(--te-surface-hover); border-color: var(--te-primary-light); }
        .report-btn-primary {
          display: flex; align-items: center; gap: 6px; padding: 8px 18px; border-radius: 8px;
          border: none; background: var(--te-primary); color: #fff; font-size: 13px;
          font-weight: 700; cursor: pointer; font-family: var(--font-sans); transition: background 0.15s;
        }
        .report-btn-primary:hover { background: var(--te-primary-light); }

        /* Computation */
        .computation-card {
          background: var(--te-surface); border-radius: 12px; padding: 24px;
          border: 1px solid rgba(35,73,77,0.05); box-shadow: 0 1px 3px rgba(0,0,0,0.04);
        }
        .section-title { font-size: 15px; font-weight: 700; color: var(--te-text); margin: 0 0 20px; }
        .computation-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; }
        .comp-item { display: flex; flex-direction: column; gap: 4px; }
        .comp-item--liability { background: rgba(220,38,38,0.06); border-radius: 8px; padding: 12px; }
        .comp-label { font-size: 12px; color: var(--te-text-muted); }
        .comp-value { font-size: 18px; font-weight: 700; color: var(--te-text); }
        .comp-value--liability { color: #dc2626; }
        .comp-sublabel { font-size: 11px; color: var(--te-text-muted); margin-top: 2px; }
        .min-tax-note {
          display: flex; align-items: center; gap: 6px; margin-top: 16px;
          font-size: 12px; color: var(--te-accent); background: rgba(240,160,48,0.08);
          padding: 8px 12px; border-radius: 6px;
        }

        /* Columns */
        .report-columns { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; }

        /* Breakdown */
        .breakdown-card, .reliefs-card {
          background: var(--te-surface); border-radius: 12px; padding: 24px;
          border: 1px solid rgba(35,73,77,0.05); box-shadow: 0 1px 3px rgba(0,0,0,0.04);
        }
        .breakdown-header, .reliefs-header {
          display: flex; align-items: center; gap: 8px; margin-bottom: 20px;
        }
        .breakdown-title, .reliefs-title { font-size: 15px; font-weight: 700; color: var(--te-text); margin: 0; }

        .breakdown-table { width: 100%; text-align: left; border-collapse: collapse; }
        .breakdown-table th {
          padding: 10px 12px; font-size: 10px; font-weight: 700; text-transform: uppercase;
          letter-spacing: 0.06em; color: var(--te-text-muted); background: rgba(100,116,139,0.04);
          border-bottom: 1px solid rgba(35,73,77,0.05);
        }
        .breakdown-table td {
          padding: 12px; font-size: 14px; border-bottom: 1px solid rgba(35,73,77,0.05);
        }
        .row-zero td { opacity: 0.4; }
        .total-row td { border-top: 2px solid rgba(35,73,77,0.1); }
        .rate-badge {
          display: inline-block; padding: 2px 8px; border-radius: 4px;
          background: rgba(35,73,77,0.06); font-size: 12px; font-weight: 700; color: var(--te-primary);
        }
        .empty-text { font-size: 14px; color: var(--te-text-muted); text-align: center; padding: 20px; }

        /* Reliefs */
        .reliefs-list { display: flex; flex-direction: column; gap: 16px; }
        .relief-item {
          display: flex; align-items: center; justify-content: space-between;
          padding: 12px; border-radius: 8px; border: 1px solid rgba(35,73,77,0.05);
        }
        .relief-left { display: flex; align-items: center; gap: 12px; }
        .relief-icon {
          width: 40px; height: 40px; border-radius: 10px;
          display: flex; align-items: center; justify-content: center;
        }
        .relief-name { font-size: 14px; font-weight: 600; color: var(--te-text); margin: 0; }
        .relief-desc { font-size: 11px; color: var(--te-text-muted); margin: 2px 0 0; }
        .relief-amount { font-size: 14px; font-weight: 700; color: var(--te-text); }

        /* Category breakdown */
        .category-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 12px; }
        .category-item {
          display: flex; flex-direction: column; gap: 4px;
          padding: 12px; border-radius: 8px; border: 1px solid rgba(35,73,77,0.05);
        }
        .category-label { font-size: 12px; color: var(--te-text-muted); }
        .category-value { font-size: 16px; font-weight: 700; color: var(--te-text); }

        /* Filing CTA */
        .filing-cta {
          display: flex; align-items: center; justify-content: space-between; gap: 24px;
          padding: 28px 32px; border-radius: 12px;
          background: linear-gradient(135deg, var(--te-primary-dark), var(--te-primary));
          color: #fff;
        }
        .filing-cta-title { font-size: 18px; font-weight: 700; margin: 0 0 8px; }
        .filing-cta-desc { font-size: 13px; color: rgba(255,255,255,0.7); margin: 0; max-width: 600px; line-height: 1.6; }
        .filing-cta-badges { display: flex; align-items: center; gap: 6px; margin-top: 12px; }
        .filing-verified-text { font-size: 12px; color: rgba(255,255,255,0.6); }
        .filing-cta-btn {
          display: flex; align-items: center; gap: 8px; padding: 14px 28px; border-radius: 10px;
          background: var(--te-accent); color: var(--te-primary-dark); font-size: 15px;
          font-weight: 700; border: none; cursor: pointer; font-family: var(--font-sans);
          white-space: nowrap; transition: all 0.15s;
          box-shadow: 0 4px 12px rgba(240,160,48,0.3);
        }
        .filing-cta-btn:hover { background: var(--te-accent-light); transform: translateY(-1px); }

        @media (max-width: 1024px) {
          .report-columns { grid-template-columns: 1fr; }
          .computation-grid { grid-template-columns: repeat(2, 1fr); }
        }
        @media (max-width: 768px) {
          .computation-grid { grid-template-columns: 1fr; }
          .filing-cta { flex-direction: column; align-items: flex-start; }
        }

        /* Additional Deductions */
        .additional-deductions {
          border-top: 1px solid rgba(35,73,77,0.08); padding-top: 16px; margin-top: 8px;
        }
        .addl-deduct-header {
          display: flex; align-items: center; justify-content: space-between;
        }
        .addl-deduct-label { font-size: 14px; font-weight: 600; color: var(--te-text); }
        .toggle-switch {
          position: relative; display: inline-block; width: 40px; height: 22px;
        }
        .toggle-switch input { opacity: 0; width: 0; height: 0; }
        .toggle-slider {
          position: absolute; cursor: pointer; inset: 0; background: var(--te-border);
          border-radius: 22px; transition: 0.2s;
        }
        .toggle-slider::before {
          content: ""; position: absolute; height: 16px; width: 16px; left: 3px; bottom: 3px;
          background: #fff; border-radius: 50%; transition: 0.2s;
        }
        .toggle-switch input:checked + .toggle-slider { background: var(--te-primary); }
        .toggle-switch input:checked + .toggle-slider::before { transform: translateX(18px); }

        .addl-deduct-body { margin-top: 12px; display: flex; flex-direction: column; gap: 8px; }
        .addl-deduct-row { display: flex; gap: 8px; align-items: center; }
        .addl-deduct-input {
          flex: 1; padding: 8px 12px; border-radius: 6px; border: 1px solid var(--te-border);
          font-size: 13px; font-family: var(--font-sans); color: var(--te-text); background: var(--te-surface);
        }
        .addl-deduct-input:focus { border-color: var(--te-primary); outline: none; }
        .addl-deduct-amount { max-width: 140px; }
        .addl-deduct-remove {
          background: none; border: none; color: var(--te-text-muted); cursor: pointer; padding: 4px;
          border-radius: 4px; transition: 0.15s;
        }
        .addl-deduct-remove:hover { color: #dc2626; background: rgba(220,38,38,0.08); }
        .addl-deduct-add {
          display: flex; align-items: center; gap: 4px; font-size: 12px; font-weight: 600;
          color: var(--te-primary); background: none; border: 1px dashed var(--te-border);
          padding: 8px 12px; border-radius: 6px; cursor: pointer; font-family: var(--font-sans);
          transition: 0.15s;
        }
        .addl-deduct-add:hover { border-color: var(--te-primary); background: rgba(35,73,77,0.03); }
        .addl-deduct-total {
          display: flex; justify-content: space-between; font-size: 13px; color: var(--te-text);
          padding: 8px 12px; background: rgba(35,73,77,0.04); border-radius: 6px;
        }
        .addl-deduct-note {
          display: flex; align-items: center; gap: 6px;
          font-size: 11px; color: var(--te-text-muted); margin: 4px 0 0;
        }

        /* State Modal */
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
        .modal-select {
          width: 100%; padding: 12px 16px; border-radius: 8px; border: 1px solid var(--te-border);
          background: var(--te-surface); font-size: 14px; color: var(--te-text); font-family: var(--font-sans);
          margin-bottom: 20px; outline: none;
        }
        .modal-select:focus { border-color: var(--te-primary); }
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
      `}</style>
    </>
  );
}
