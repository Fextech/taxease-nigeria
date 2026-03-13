"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useWorkspace } from "@/components/dashboard/WorkspaceContext";

const months = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

interface OverviewData {
  taxYear: number;
  metrics: {
    grossIncome: string;
    taxableIncome: string;
    cra: string;
    taxLiability: string;
    effectiveRate: number;
  };
  monthlyChart: { month: number; amount: string; pct: number }[];
  recentTransactions: {
    id: string;
    date: string;
    description: string;
    creditAmount: string;
    debitAmount: string;
    annotationStatus: string | null;
    taxableStatus: string | null;
  }[];
  compliance: {
    quarter: string;
    status: string;
    uploaded: number;
    total: number;
  }[];
  stats: {
    totalTransactions: number;
    annotatedTransactions: number;
  };
}

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

function getStatusStyle(status: string) {
  if (status === "FILED") return { bg: "rgba(16,185,129,0.06)", border: "rgba(16,185,129,0.15)", icon: "check_circle", iconColor: "#059669", badgeBg: "rgba(16,185,129,0.12)", badgeColor: "#047857" };
  if (status === "PENDING") return { bg: "rgba(245,158,11,0.06)", border: "rgba(245,158,11,0.15)", icon: "pending", iconColor: "#d97706", badgeBg: "rgba(245,158,11,0.12)", badgeColor: "#b45309" };
  return { bg: "rgba(100,116,139,0.04)", border: "rgba(100,116,139,0.12)", icon: "radio_button_unchecked", iconColor: "#94a3b8", badgeBg: "rgba(100,116,139,0.1)", badgeColor: "#64748b" };
}

export default function DashboardPage() {
  useSession();
  const { activeWorkspaceId, activeWorkspace } = useWorkspace();
  const [data, setData] = useState<OverviewData | null>(null);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async (wsId: string) => {
    setLoading(true);
    try {
      const res = await fetch("/api/dashboard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "overview", workspaceId: wsId }),
      });
      if (res.ok) {
        setData(await res.json());
      } else {
        setData(null);
      }
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeWorkspaceId) {
      loadData(activeWorkspaceId);
    } else {
      setData(null);
      setLoading(false);
    }
  }, [activeWorkspaceId, loadData]);

  if (loading && !data) {
    return (
      <div className="dash-loading">
        <span className="material-symbols-outlined status-spin" style={{ fontSize: 24, color: "var(--te-primary)" }}>sync</span>
        <p>Loading dashboard...</p>
      </div>
    );
  }

  if (!activeWorkspace || !data) {
    return (
      <div className="dash-empty">
        <span className="material-symbols-outlined" style={{ fontSize: 32, color: "var(--te-text-muted)" }}>dashboard</span>
        <p>Create or select a Tax Year from the header to view your dashboard.</p>
      </div>
    );
  }

  // Map chart data to ensure all 12 months exist
  const chartData = months.map((m, i) => {
    const monthIndex = i + 1;
    const dp = data.monthlyChart.find(d => d.month === monthIndex);
    return {
      label: m,
      pct: dp ? dp.pct : 0,
      color: dp && dp.pct > 70 ? "mint" : "primary"
    };
  });

  return (
    <>
      <div className="annual-summary">
        {/* Metric Cards */}
        <div className="metric-grid">
          <div className="metric-card">
            <p className="metric-label">Total Income</p>
            <h3 className="metric-value" style={{ color: "var(--te-primary)" }}>
              {formatKobo(data.metrics.grossIncome)}
            </h3>
            <div className="metric-trend metric-trend--up">
              <span>Gross Earnings</span>
            </div>
          </div>
          <div className="metric-card">
            <p className="metric-label">Taxable Income</p>
            <h3 className="metric-value" style={{ color: "var(--te-primary)" }}>
              {formatKobo(data.metrics.taxableIncome)}
            </h3>
            <div className="metric-trend">
              <span>After deductions</span>
            </div>
          </div>
          <div className="metric-card">
            <p className="metric-label">CRA (Relief)</p>
            <h3 className="metric-value" style={{ color: "var(--te-mint)" }}>
              {formatKobo(data.metrics.cra)}
            </h3>
            <div className="metric-trend metric-trend--up">
              <span>Standard Applied</span>
            </div>
          </div>
          <div className="metric-card">
            <p className="metric-label">Tax Liability</p>
            <h3 className="metric-value" style={{ color: "var(--te-error)" }}>
              {formatKobo(data.metrics.taxLiability)}
            </h3>
            <div className="metric-trend metric-trend--warn">
              <span className="material-symbols-outlined" style={{ fontSize: 14 }}>schedule</span>
              <span>P.A.Y.E Computed</span>
            </div>
          </div>
          <div className="metric-card">
            <p className="metric-label">Eff. Tax Rate</p>
            <h3 className="metric-value" style={{ color: "var(--te-primary)" }}>
              {data.metrics.effectiveRate.toFixed(1)}%
            </h3>
            <div className="metric-trend metric-trend--up">
              <span>Avg overall rate</span>
            </div>
          </div>
        </div>

        {/* Main Content Row */}
        <div className="content-row">
          {/* Bar Chart */}
          <div className="chart-card">
            <div className="chart-header">
              <div>
                <h4 className="card-title">Monthly Income Distribution</h4>
                <p className="card-subtitle">Visual breakdown of earnings across {activeWorkspace.taxYear}</p>
              </div>
            </div>
            <div className="bar-chart">
              {chartData.map((d, i) => (
                <div key={d.label} className="bar-col">
                  <div className="bar-track">
                    <div
                      className={`bar-fill bar-fill--${d.color}`}
                      style={{ height: `${d.pct}%` }}
                    />
                  </div>
                  <span className="bar-label">{d.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Filing Compliance */}
          <div className="compliance-card">
            <div className="compliance-header">
              <span className="material-symbols-outlined" style={{ color: "var(--te-primary-light)" }}>assignment_turned_in</span>
              <h4 className="card-title">Tax Year {activeWorkspace.taxYear} Compliance</h4>
            </div>
            <p className="card-subtitle">Ensure all monthly statements are uploaded to avoid penalties.</p>
            
            <div className="compliance-list">
              {data.compliance.map((c) => {
                const style = getStatusStyle(c.status);
                return (
                  <div key={c.quarter} className="comp-item" style={{ background: style.bg, borderColor: style.border }}>
                    <div className="comp-info">
                      <span className="material-symbols-outlined" style={{ color: style.iconColor }}>{style.icon}</span>
                      <div>
                        <p className="comp-q">{c.quarter}</p>
                        <p className="comp-desc">{c.uploaded} of {c.total} statements uploaded</p>
                      </div>
                    </div>
                    <span className="comp-badge" style={{ background: style.badgeBg, color: style.badgeColor }}>
                      {c.status}
                    </span>
                  </div>
                );
              })}
            </div>
            {data.metrics.effectiveRate > 0 && (
              <a href="/reports" className="view-report-btn">Complete Tax Report →</a>
            )}
          </div>
        </div>

        {/* Recent Transactions */}
        <div className="tx-card">
          <div className="tx-header">
            <h4 className="card-title">Recent Transactions</h4>
            <a href="/annotations" className="tx-view-all">View All →</a>
          </div>
          
          <div className="tx-table-wrap">
            <table className="tx-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Description</th>
                  <th>Amount</th>
                  <th>Annotation</th>
                </tr>
              </thead>
              <tbody>
                {data.recentTransactions.length === 0 ? (
                  <tr>
                    <td colSpan={4} style={{ textAlign: "center", padding: "20px 0", color: "var(--te-text-muted)" }}>
                      No recent transactions. Upload a statement first.
                    </td>
                  </tr>
                ) : data.recentTransactions.map((tx) => {
                  const isCredit = BigInt(tx.creditAmount) > 0n;
                  const amount = isCredit ? tx.creditAmount : tx.debitAmount;
                  const annStatus = tx.annotationStatus || "UNANNOTATED";
                  
                  return (
                    <tr key={tx.id}>
                      <td className="tx-date">{formatDate(tx.date)}</td>
                      <td className="tx-desc">{tx.description}</td>
                      <td style={{ color: isCredit ? "var(--te-primary)" : "#dc2626", fontWeight: 600 }}>
                        {isCredit ? "" : "-"}{formatKobo(amount)}
                      </td>
                      <td>
                        <span className={`tx-status tx-status--${annStatus.toLowerCase()}`}>{annStatus}</span>
                        {tx.taxableStatus === "YES" && <span className="tx-status tx-status--taxable" style={{ marginLeft: 6 }}>TAXABLE</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <style jsx>{`
        .annual-summary {
          display: flex;
          flex-direction: column;
          gap: 24px;
        }

        .dash-loading, .dash-empty {
          display: flex; flex-direction: column; align-items: center; justify-content: center;
          padding: 60px 20px; color: var(--te-text-muted); text-align: center;
        }
        .dash-loading p, .dash-empty p { margin-top: 12px; font-size: 15px; }
        .status-spin { animation: spin 1.5s linear infinite; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }

        /* Metric Cards */
        .metric-grid {
          display: grid;
          grid-template-columns: repeat(5, 1fr);
          gap: 16px;
        }
        .metric-card {
          background: var(--te-surface);
          border-radius: 12px;
          padding: 20px;
          border: 1px solid rgba(35, 73, 77, 0.05);
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
        }
        .metric-label {
          font-size: 11px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          color: var(--te-text-muted);
          margin: 0 0 8px;
        }
        .metric-value {
          font-size: 24px;
          font-weight: 700;
          margin: 0 0 12px;
        }
        .metric-trend {
          display: flex;
          align-items: center;
          gap: 4px;
          font-size: 12px;
          color: var(--te-text-muted);
        }
        .metric-trend--up { color: var(--te-mint); font-weight: 500; }
        .metric-trend--warn { color: var(--te-accent); font-weight: 500; }

        /* Content Row */
        .content-row {
          display: grid;
          grid-template-columns: 2fr 1fr;
          gap: 20px;
        }
        .chart-card, .compliance-card {
          background: var(--te-surface);
          border-radius: 12px;
          padding: 24px;
          border: 1px solid rgba(35, 73, 77, 0.05);
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
        }
        .card-title {
          font-size: 16px;
          font-weight: 700;
          color: var(--te-text);
          margin: 0;
        }
        .card-subtitle {
          font-size: 13px;
          color: var(--te-text-muted);
          margin: 4px 0 0;
        }

        /* Chart */
        .chart-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 24px;
        }
        .bar-chart {
          display: flex;
          align-items: flex-end;
          gap: 12px;
          height: 220px;
          padding-top: 20px;
          border-bottom: 1px solid var(--te-border-light);
        }
        .bar-col {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 12px;
          height: 100%;
        }
        .bar-track {
          width: 32px;
          height: 100%;
          background: rgba(35, 73, 77, 0.04);
          border-radius: 6px;
          display: flex;
          align-items: flex-end;
        }
        .bar-fill {
          width: 100%;
          border-radius: 6px;
          transition: height 0.6s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .bar-fill--primary { background: linear-gradient(180deg, var(--te-primary-light), var(--te-primary)); }
        .bar-fill--mint { background: linear-gradient(180deg, var(--te-mint), #059669); }
        .bar-label {
          font-size: 11px;
          font-weight: 600;
          color: var(--te-text-muted);
        }

        /* Compliance */
        .compliance-header {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .compliance-list {
          margin-top: 20px;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .comp-item {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 12px;
          border-radius: 8px;
          border: 1px solid;
        }
        .comp-info {
          display: flex;
          align-items: center;
          gap: 12px;
        }
        .comp-q {
          font-size: 14px;
          font-weight: 600;
          color: var(--te-text);
          margin: 0;
        }
        .comp-desc {
          font-size: 11px;
          color: var(--te-text-muted);
          margin: 2px 0 0;
        }
        .comp-badge {
          font-size: 10px;
          font-weight: 700;
          padding: 4px 8px;
          border-radius: 4px;
        }
        .view-report-btn {
          display: block;
          margin-top: 20px;
          text-align: center;
          padding: 12px;
          background: rgba(35, 73, 77, 0.05);
          color: var(--te-primary);
          border-radius: 8px;
          text-decoration: none;
          font-weight: 600;
          font-size: 13px;
          transition: background 0.15s;
        }
        .view-report-btn:hover { background: rgba(35, 73, 77, 0.08); }

        /* Transactions */
        .tx-card {
          background: var(--te-surface);
          border-radius: 12px;
          border: 1px solid rgba(35, 73, 77, 0.05);
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
        }
        .tx-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 20px 24px;
          border-bottom: 1px solid rgba(35, 73, 77, 0.05);
        }
        .tx-view-all {
          font-size: 13px;
          font-weight: 600;
          color: var(--te-primary);
          text-decoration: none;
        }
        .tx-view-all:hover { text-decoration: underline; }
        
        .tx-table-wrap { overflow-x: auto; }
        .tx-table {
          width: 100%;
          border-collapse: collapse;
          text-align: left;
        }
        .tx-table th {
          padding: 12px 24px;
          font-size: 11px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: var(--te-text-muted);
          background: rgba(100,116,139,0.03);
        }
        .tx-table td {
          padding: 16px 24px;
          font-size: 14px;
          border-bottom: 1px solid rgba(35, 73, 77, 0.05);
        }
        .tx-date { font-size: 13px; color: var(--te-text-secondary); }
        .tx-desc { font-weight: 600; color: var(--te-text); }
        .tx-status {
          display: inline-block;
          font-size: 10px;
          font-weight: 700;
          padding: 4px 8px;
          border-radius: 4px;
        }
        .tx-status--unannotated { background: rgba(245, 158, 11, 0.1); color: #d97706; }
        .tx-status--complete { background: rgba(16, 185, 129, 0.1); color: #059669; }
        .tx-status--taxable { background: rgba(35, 73, 77, 0.1); color: var(--te-primary-dark); }

        @media (max-width: 1024px) {
          .metric-grid { grid-template-columns: repeat(3, 1fr); }
          .content-row { grid-template-columns: 1fr; }
        }
        @media (max-width: 768px) {
          .metric-grid { grid-template-columns: 1fr; }
          .bar-track { width: 100%; }
        }
      `}</style>
    </>
  );
}
