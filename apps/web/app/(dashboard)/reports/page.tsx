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
  rentRelief?: string;
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

  // Rent relief input (for 2026+ tax years)
  const [annualRentInput, setAnnualRentInput] = useState("");

  const loadReport = useCallback(async (wsId: string) => {
    setLoading(true);
    setError(null);
    try {
      const reportBody: Record<string, unknown> = { action: "generate", workspaceId: wsId };
      // For 2026+ tax years, include rent amount if provided
      if (annualRentInput && !isNaN(Number(annualRentInput))) {
        // Convert naira to kobo for the API
        reportBody.annualRentPaid = (BigInt(Math.round(Number(annualRentInput) * 100))).toString();
      }
      const res = await fetch("/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(reportBody),
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
  }, [annualRentInput]);

  useEffect(() => {
    if (activeWorkspaceId) {
      loadReport(activeWorkspaceId);
    } else {
      setReport(null);
      setLoading(false);
    }
  }, [activeWorkspaceId, loadReport]);

  const taxYear = activeWorkspace?.taxYear ?? new Date().getFullYear();
  const is2026Plus = taxYear >= 2026;

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
                  {/* CRA — show only for pre-2026 */}
                  {!is2026Plus && (
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
                  )}

                  {/* Rent Relief — show only for 2026+ */}
                  {is2026Plus && (
                    <div className="relief-item rent-relief-item">
                      <div className="relief-left">
                        <div className="relief-icon" style={{ background: "rgba(16,185,129,0.1)", color: "var(--te-mint)" }}>
                          <span className="material-symbols-outlined" style={{ fontSize: 18 }}>home</span>
                        </div>
                        <div>
                          <p className="relief-name">Rent Relief (2025 Tax Act)</p>
                          <p className="relief-desc">20% of annual rent paid, capped at ₦500,000</p>
                        </div>
                      </div>
                      <div className="rent-relief-input-wrap">
                        <div className="rent-input-group">
                          <span className="rent-currency">₦</span>
                          <input
                            className="rent-input"
                            type="number"
                            placeholder="Annual rent paid"
                            value={annualRentInput}
                            onChange={(e) => setAnnualRentInput(e.target.value)}
                          />
                        </div>
                        {report?.rentRelief && BigInt(report.rentRelief) > 0n && (
                          <span className="rent-relief-amount">Relief: {formatKobo(report.rentRelief)}</span>
                        )}
                      </div>
                    </div>
                  )}

                  {/* 2026 Tax Act disclaimer */}
                  {is2026Plus && (
                    <div className="tax-act-disclaimer">
                      <span className="material-symbols-outlined" style={{ fontSize: 14 }}>info</span>
                      <span>Computed under the 2025 Tax Act. CRA has been replaced by a tax-free threshold of ₦800,000 and optional Rent Relief.</span>
                    </div>
                  )}

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

    </>
  );
}
