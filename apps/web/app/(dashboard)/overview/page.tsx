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
              {chartData.map((d) => (
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

    </>
  );
}
