"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { formatNumber } from "@/lib/utils";

export default function BillingPage() {
  const [txCursor, setTxCursor] = useState<string | null>(null);

  const { data: stats, isLoading: statsLoading } = trpc.admin.billing.getBillingStats.useQuery();
  const { data: plans, isLoading: plansLoading } = trpc.admin.billing.getPlans.useQuery();
  const { data: txData, isLoading: txLoading } = trpc.admin.billing.listTransactions.useQuery({
    limit: 10,
    cursor: txCursor || undefined,
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h2 style={{ fontSize: 22, fontWeight: 800, color: "var(--admin-text)", margin: 0 }}>Billing & Revenue Management</h2>
          <p style={{ fontSize: 13, color: "var(--admin-text-muted)", margin: "4px 0 0" }}>Configure subscription plans and monitor financial health across the platform.</p>
        </div>
        <button className="admin-btn admin-btn--primary">
          <span className="material-symbols-outlined" style={{ fontSize: 16 }}>add</span>
          Create New Plan
        </button>
      </div>

      {/* KPI Cards */}
      <div className="admin-kpi-grid" style={{ gridTemplateColumns: "repeat(4, 1fr)" }}>
        {[
          { label: "Monthly Recurring Revenue", value: stats ? `₦${formatNumber(stats.currentMrr)}` : "...", trend: stats?.mrrTrend || "-", trendDir: stats?.mrrTrendDir || "neutral" },
          { label: "Avg Revenue Per User", value: stats ? `₦${formatNumber(stats.arpuNgn)}` : "...", trend: "Active PRO", trendDir: "neutral" },
          { label: "Total Platform Revenue", value: stats ? `₦${formatNumber(stats.totalRevenueNgn)}` : "...", trend: "All time", trendDir: "up" },
          { label: "Failed Payments (24h)", value: statsLoading ? "..." : `${stats?.failedPayments24h || 0}`, trend: "Needs attention", trendDir: stats?.failedPayments24h && stats.failedPayments24h > 0 ? "down" : "success" },
        ].map((kpi) => (
          <div key={kpi.label} className="admin-kpi-card">
            <p className="admin-kpi-label">{kpi.label}</p>
            <p className="admin-kpi-value">{kpi.value}</p>
            <div className={`admin-kpi-trend admin-kpi-trend--${kpi.trendDir}`}>
              {kpi.trend}
            </div>
          </div>
        ))}
      </div>

      {/* Revenue + Plans Row */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
        <div className="admin-card">
          <div className="admin-card-header">
            <h3 className="admin-card-title">Revenue Growth</h3>
            <select className="admin-select"><option>Last 12 Months</option></select>
          </div>
          <div style={{ padding: "40px 0", textAlign: "center", color: "var(--admin-text-muted)", fontSize: 13 }}>
            <span className="material-symbols-outlined" style={{ fontSize: 36, opacity: 0.3, display: "block", marginBottom: 8 }}>show_chart</span>
            Revenue chart renders with live data
          </div>
        </div>

        <div className="admin-card">
          <h3 className="admin-card-title" style={{ marginBottom: 16 }}>Subscription Plans</h3>
          {plansLoading ? (
            <p style={{ color: "var(--admin-text-muted)" }}>Loading plans...</p>
          ) : (
            plans?.map((plan) => (
              <div key={plan.name} className="admin-card" style={{ marginBottom: 12, background: "var(--admin-bg)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <h4 style={{ fontSize: 15, fontWeight: 700, color: "var(--admin-text)", margin: 0 }}>{plan.name}</h4>
                  <span className="admin-badge admin-badge--cyan">{plan.badge}</span>
                </div>
                <p style={{ fontSize: 22, fontWeight: 800, color: "var(--admin-text)", margin: "0 0 8px" }}>
                  {plan.price}<span style={{ fontSize: 12, color: "var(--admin-text-muted)" }}>{plan.id === 'pro' ? '/yr' : '/mo'}</span>
                </p>
                <ul style={{ fontSize: 12, color: "var(--admin-text-muted)", margin: "0 0 12px", paddingLeft: 16 }}>
                  {plan.features.map((f: string) => <li key={f} style={{ marginBottom: 4 }}>{f}</li>)}
                </ul>
                <button className="admin-btn admin-btn--secondary admin-btn--sm" style={{ width: "100%" }}>Edit Plan</button>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Transaction Ledger */}
      <div className="admin-card" style={{ padding: 0, overflow: "hidden" }}>
        <div style={{ padding: "16px 20px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <h3 className="admin-card-title">Transaction Ledger</h3>
            <p style={{ fontSize: 12, color: "var(--admin-text-muted)", margin: "2px 0 0" }}>Full record of all Paystack transactions</p>
          </div>
        </div>
        <table className="admin-table">
          <thead>
            <tr>
              <th>Ref / Date</th>
              <th>Customer</th>
              <th>Plan</th>
              <th>Amount</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {txLoading ? (
               <tr><td colSpan={5} style={{ textAlign: "center", padding: 20 }}>Loading statements...</td></tr>
            ) : txData?.items.length === 0 ? (
               <tr><td colSpan={5} style={{ textAlign: "center", padding: 20 }}>No transactions found.</td></tr>
            ) : (
              txData?.items.map((tx: any) => (
                <tr key={tx.id}>
                  <td>
                    <span style={{ fontFamily: "monospace", fontSize: 12 }}>{tx.reference.substring(0, 16)}</span><br/>
                    <span style={{ fontSize: 11, color: "var(--admin-text-muted)" }}>{new Date(tx.createdAt).toLocaleString()}</span>
                  </td>
                  <td>
                    {tx.user?.name || "Unknown"} <br/>
                    <span style={{ fontSize: 11, color: "var(--admin-text-muted)" }}>{tx.user?.email || ""}</span>
                  </td>
                  <td><span className={`admin-badge ${tx.user?.plan === 'PRO' ? 'admin-badge--pro' : 'admin-badge--free'}`}>{tx.user?.plan || "N/A"}</span></td>
                  <td>₦{formatNumber(tx.amountNgn)}</td>
                  <td>
                    <span className={`admin-badge ${tx.status === "success" ? "admin-badge--success" : tx.status === "failed" ? "admin-badge--error" : "admin-badge--warning"}`}>
                      {tx.status}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        <div className="admin-pagination" style={{ padding: "12px 16px" }}>
          <span style={{ color: "var(--admin-text-muted)", fontSize: 13 }}>
            Showing {txData?.items.length || 0} transactions
          </span>
          <div className="admin-pagination-controls">
            <button
              className="admin-pagination-btn admin-btn--ghost"
              disabled={!txData?.nextCursor}
              onClick={() => setTxCursor(txData?.nextCursor || null)}
            >
              Next Page <span className="material-symbols-outlined" style={{ fontSize: 16 }}>chevron_right</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
