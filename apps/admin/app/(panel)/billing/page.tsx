"use client";

import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { formatNumber } from "@/lib/utils";

function PricingCard({
  icon,
  title,
  description,
  currentKobo,
  suffix,
  onSave,
  isSaving,
  saveError,
}: {
  icon: string;
  title: string;
  description: string;
  currentKobo: number;
  suffix: string;
  onSave: (newKobo: number) => Promise<any>;
  isSaving: boolean;
  saveError?: string | null;
}) {
  const [editing, setEditing] = useState(false);
  const [nairaValue, setNairaValue] = useState(String(currentKobo / 100));

  useEffect(() => {
    if (!editing) {
      setNairaValue(String(currentKobo / 100));
    }
  }, [currentKobo, editing]);

  const handleSave = async () => {
    const parsed = parseFloat(nairaValue);
    if (isNaN(parsed) || parsed < 0) return;
    try {
      await onSave(Math.round(parsed * 100));
      setEditing(false);
    } catch {
      // Error is surfaced via saveError prop
    }
  };

  return (
    <div style={{
      background: "var(--admin-card-bg)",
      border: "1px solid var(--admin-border)",
      borderRadius: 12,
      padding: 20,
      display: "flex",
      flexDirection: "column",
      gap: 12,
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <div style={{
            width: 40,
            height: 40,
            borderRadius: 10,
            background: "rgba(0,210,211,0.1)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}>
            <span className="material-symbols-outlined" style={{ fontSize: 20, color: "var(--admin-cyan)" }}>{icon}</span>
          </div>
          <div>
            <h4 style={{ fontSize: 14, fontWeight: 700, color: "var(--admin-text)", margin: 0 }}>{title}</h4>
            <p style={{ fontSize: 12, color: "var(--admin-text-muted)", margin: "2px 0 0" }}>{description}</p>
          </div>
        </div>
        {!editing && (
          <button
            className="admin-btn admin-btn--ghost admin-btn--sm"
            onClick={() => setEditing(true)}
            style={{ fontSize: 12 }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 14 }}>edit</span>
            Edit
          </button>
        )}
      </div>

      {saveError && editing && (
        <div style={{ fontSize: 12, color: "#ef4444", paddingLeft: 52 }}>
          <span className="material-symbols-outlined" style={{ fontSize: 14, verticalAlign: "middle" }}>error</span> {saveError}
        </div>
      )}

      {!editing ? (
        <div style={{ paddingLeft: 52 }}>
          <span style={{ fontSize: 28, fontWeight: 800, color: "var(--admin-text)" }}>
            ₦{formatNumber(currentKobo / 100)}
          </span>
          <span style={{ fontSize: 13, color: "var(--admin-text-muted)", marginLeft: 4 }}>{suffix}</span>
        </div>
      ) : (
        <div style={{ paddingLeft: 52, display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 16, fontWeight: 700, color: "var(--admin-text)" }}>₦</span>
            <input
              type="number"
              value={nairaValue}
              onChange={(e) => setNairaValue(e.target.value)}
              min={0}
              step="0.01"
              style={{
                background: "var(--admin-bg)",
                border: "1px solid var(--admin-border)",
                borderRadius: 8,
                padding: "8px 12px",
                color: "var(--admin-text)",
                fontSize: 16,
                fontWeight: 700,
                width: 160,
                outline: "none",
              }}
              autoFocus
            />
            <span style={{ fontSize: 13, color: "var(--admin-text-muted)" }}>{suffix}</span>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              className="admin-btn admin-btn--primary admin-btn--sm"
              onClick={handleSave}
              disabled={isSaving}
              style={{ fontSize: 12 }}
            >
              {isSaving ? "Saving…" : "Save"}
            </button>
            <button
              className="admin-btn admin-btn--ghost admin-btn--sm"
              onClick={() => { setEditing(false); setNairaValue(String(currentKobo / 100)); }}
              disabled={isSaving}
              style={{ fontSize: 12 }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function CreditsCard({
  currentPriceKobo,
  standardCredits,
  onSavePrice,
  onSaveCredits,
  isSaving,
  saveError,
}: {
  currentPriceKobo: number;
  standardCredits: number;
  onSavePrice: (newKobo: number) => Promise<any>;
  onSaveCredits: (credits: number) => Promise<any>;
  isSaving: boolean;
  saveError?: string | null;
}) {
  const [editingPrice, setEditingPrice] = useState(false);
  const [editingCredits, setEditingCredits] = useState(false);
  const [priceValue, setPriceValue] = useState(String(currentPriceKobo / 100));
  const [creditsValue, setCreditsValue] = useState(String(standardCredits));

  useEffect(() => {
    if (!editingPrice) setPriceValue(String(currentPriceKobo / 100));
    if (!editingCredits) setCreditsValue(String(standardCredits));
  }, [currentPriceKobo, standardCredits, editingPrice, editingCredits]);

  return (
    <div style={{
      background: "var(--admin-card-bg)",
      border: "1px solid var(--admin-border)",
      borderRadius: 12,
      padding: 20,
      display: "flex",
      flexDirection: "column",
      gap: 16,
    }}>
      <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
        <div style={{
          width: 40,
          height: 40,
          borderRadius: 10,
          background: "rgba(0,210,211,0.1)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}>
          <span className="material-symbols-outlined" style={{ fontSize: 20, color: "var(--admin-cyan)" }}>local_activity</span>
        </div>
        <div>
          <h4 style={{ fontSize: 14, fontWeight: 700, color: "var(--admin-text)", margin: 0 }}>Unlock Credits</h4>
          <p style={{ fontSize: 12, color: "var(--admin-text-muted)", margin: "2px 0 0" }}>Price per credit for unlocking individual months</p>
        </div>
      </div>

      {saveError && (editingPrice || editingCredits) && (
        <div style={{ fontSize: 12, color: "#ef4444" }}>
          <span className="material-symbols-outlined" style={{ fontSize: 14, verticalAlign: "middle" }}>error</span> {saveError}
        </div>
      )}

      {/* Price per credit */}
      <div style={{
        background: "var(--admin-bg)",
        border: "1px solid var(--admin-border)",
        borderRadius: 8,
        padding: "12px 16px",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
          <span style={{ fontSize: 12, color: "var(--admin-text-muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5 }}>Price Per Credit</span>
          {!editingPrice && (
            <button className="admin-btn admin-btn--ghost admin-btn--sm" onClick={() => setEditingPrice(true)} style={{ fontSize: 11, padding: "2px 8px" }}>
              <span className="material-symbols-outlined" style={{ fontSize: 12 }}>edit</span>
            </button>
          )}
        </div>
        {!editingPrice ? (
          <span style={{ fontSize: 22, fontWeight: 800, color: "var(--admin-text)" }}>₦{formatNumber(currentPriceKobo / 100)}</span>
        ) : (
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4 }}>
            <span style={{ fontWeight: 700, color: "var(--admin-text)" }}>₦</span>
            <input type="number" value={priceValue} onChange={(e) => setPriceValue(e.target.value)} min={0} step="0.01" autoFocus
              style={{ background: "var(--admin-card-bg)", border: "1px solid var(--admin-border)", borderRadius: 6, padding: "6px 10px", color: "var(--admin-text)", fontSize: 14, fontWeight: 700, width: 120, outline: "none" }}
            />
            <button className="admin-btn admin-btn--primary admin-btn--sm" disabled={isSaving} onClick={async () => { try { await onSavePrice(Math.round(parseFloat(priceValue) * 100)); setEditingPrice(false); } catch {} }} style={{ fontSize: 11 }}>
              {isSaving ? "…" : "Save"}
            </button>
            <button className="admin-btn admin-btn--ghost admin-btn--sm" disabled={isSaving} onClick={() => { setEditingPrice(false); setPriceValue(String(currentPriceKobo / 100)); }} style={{ fontSize: 11 }}>Cancel</button>
          </div>
        )}
      </div>

      {/* Standard credits included */}
      <div style={{
        background: "var(--admin-bg)",
        border: "1px solid var(--admin-border)",
        borderRadius: 8,
        padding: "12px 16px",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
          <span style={{ fontSize: 12, color: "var(--admin-text-muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5 }}>Credits Included with Unlock</span>
          {!editingCredits && (
            <button className="admin-btn admin-btn--ghost admin-btn--sm" onClick={() => setEditingCredits(true)} style={{ fontSize: 11, padding: "2px 8px" }}>
              <span className="material-symbols-outlined" style={{ fontSize: 12 }}>edit</span>
            </button>
          )}
        </div>
        {!editingCredits ? (
          <span style={{ fontSize: 22, fontWeight: 800, color: "var(--admin-text)" }}>
            {standardCredits} <span style={{ fontSize: 13, fontWeight: 400, color: "var(--admin-text-muted)" }}>credits</span>
          </span>
        ) : (
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4 }}>
            <input type="number" value={creditsValue} onChange={(e) => setCreditsValue(e.target.value)} min={1} step="1"
              style={{ background: "var(--admin-card-bg)", border: "1px solid var(--admin-border)", borderRadius: 6, padding: "6px 10px", color: "var(--admin-text)", fontSize: 14, fontWeight: 700, width: 80, outline: "none" }}
              autoFocus
            />
            <span style={{ fontSize: 13, color: "var(--admin-text-muted)" }}>credits</span>
            <button className="admin-btn admin-btn--primary admin-btn--sm" disabled={isSaving} onClick={async () => { try { await onSaveCredits(parseInt(creditsValue) || 15); setEditingCredits(false); } catch {} }} style={{ fontSize: 11 }}>
              {isSaving ? "…" : "Save"}
            </button>
            <button className="admin-btn admin-btn--ghost admin-btn--sm" disabled={isSaving} onClick={() => { setEditingCredits(false); setCreditsValue(String(standardCredits)); }} style={{ fontSize: 11 }}>Cancel</button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function BillingPage() {
  const [txCursor, setTxCursor] = useState<string | null>(null);
  const [txStatusFilter, setTxStatusFilter] = useState("All");

  // ─── Queries ──────────────────────────────────────────
  const { data: stats, isLoading: statsLoading } = trpc.admin.billing.getBillingStats.useQuery();
  const { data: pricing, isLoading: pricingLoading, refetch: refetchPricing, error: pricingError } = trpc.admin.billing.getPricingConfig.useQuery();
  console.log('DEBUG [BillingPage] pricing data:', pricing, 'Error:', pricingError);
  const { data: txData, isLoading: txLoading, refetch: refetchTx } = trpc.admin.billing.listTransactions.useQuery({
    limit: 10,
    cursor: txCursor || undefined,
    status: txStatusFilter !== "All" ? txStatusFilter : undefined,
  });

  // ─── Mutations ────────────────────────────────────────
  const syncMutation = trpc.admin.billing.syncPaystackTransactions.useMutation({
    onSuccess: () => refetchTx(),
  });

  const updatePricingMutation = trpc.admin.billing.updatePricing.useMutation({
    onSuccess: () => {
      refetchPricing();
    },
  });

  // Helper to call updatePricing and return a promise
  const savePricing = (data: Parameters<typeof updatePricingMutation.mutateAsync>[0]) => {
    return updatePricingMutation.mutateAsync(data);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h2 style={{ fontSize: 22, fontWeight: 800, color: "var(--admin-text)", margin: 0 }}>Billing &amp; Pricing</h2>
          <p style={{ fontSize: 13, color: "var(--admin-text-muted)", margin: "4px 0 0" }}>Manage pricing tiers, view revenue breakdown, and sync Paystack transactions.</p>
        </div>
        <button
          className="admin-btn admin-btn--primary"
          onClick={() => syncMutation.mutate()}
          disabled={syncMutation.isPending}
          style={{ display: "flex", alignItems: "center", gap: 6 }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: 16, animation: syncMutation.isPending ? "spin 1s linear infinite" : "none" }}>
            sync
          </span>
          {syncMutation.isPending ? "Syncing…" : "Sync from Paystack"}
        </button>
      </div>

      {/* Sync result toast */}
      {syncMutation.isSuccess && syncMutation.data && (
        <div style={{
          background: "rgba(34,197,94,0.12)",
          border: "1px solid rgba(34,197,94,0.3)",
          borderRadius: 8,
          padding: "10px 16px",
          fontSize: 13,
          color: "#22c55e",
          display: "flex",
          alignItems: "center",
          gap: 8,
        }}>
          <span className="material-symbols-outlined" style={{ fontSize: 18 }}>check_circle</span>
          Synced {syncMutation.data.synced} transactions ({syncMutation.data.skipped} skipped, {syncMutation.data.totalFromPaystack} total on Paystack)
        </div>
      )}

      {syncMutation.isError && (
        <div style={{
          background: "rgba(239,68,68,0.12)",
          border: "1px solid rgba(239,68,68,0.3)",
          borderRadius: 8,
          padding: "10px 16px",
          fontSize: 13,
          color: "#ef4444",
          display: "flex",
          alignItems: "center",
          gap: 8,
        }}>
          <span className="material-symbols-outlined" style={{ fontSize: 18 }}>error</span>
          Sync failed: {syncMutation.error?.message || "Unknown error"}
        </div>
      )}

      {updatePricingMutation.isSuccess && (
        <div style={{
          background: "rgba(34,197,94,0.12)",
          border: "1px solid rgba(34,197,94,0.3)",
          borderRadius: 8,
          padding: "10px 16px",
          fontSize: 13,
          color: "#22c55e",
          display: "flex",
          alignItems: "center",
          gap: 8,
        }}>
          <span className="material-symbols-outlined" style={{ fontSize: 18 }}>check_circle</span>
          Pricing updated successfully
        </div>
      )}

      {updatePricingMutation.isError && (
        <div style={{
          background: "rgba(239,68,68,0.12)",
          border: "1px solid rgba(239,68,68,0.3)",
          borderRadius: 8,
          padding: "10px 16px",
          fontSize: 13,
          color: "#ef4444",
          display: "flex",
          alignItems: "center",
          gap: 8,
        }}>
          <span className="material-symbols-outlined" style={{ fontSize: 18 }}>error</span>
          Failed to update pricing: {updatePricingMutation.error?.message || "Unknown error"}
        </div>
      )}

      {/* KPI Cards */}
      <div className="admin-kpi-grid" style={{ gridTemplateColumns: "repeat(5, 1fr)" }}>
        {[
          {
            label: "Total Revenue",
            value: stats ? `₦${formatNumber(stats.totalRevenueNgn)}` : "...",
            trend: stats ? `${stats.totalSuccessfulTx} transactions` : "-",
            trendDir: "up",
          },
          {
            label: "Workspaces Unlocked",
            value: statsLoading ? "..." : `${stats?.workspacesUnlocked || 0}`,
            trend: stats ? `₦${formatNumber(stats.revenueByType.unlock.amountNgn)} revenue` : "-",
            trendDir: "up",
          },
          {
            label: "Credits Purchased",
            value: statsLoading ? "..." : `${stats?.totalCreditsPurchased || 0}`,
            trend: stats ? `₦${formatNumber(stats.revenueByType.credits.amountNgn)} revenue` : "-",
            trendDir: "up",
          },
          {
            label: "Paystack Balance",
            value: stats ? `₦${formatNumber(stats.availableBalance || 0)}` : "...",
            trend: "Available",
            trendDir: "neutral",
          },
          {
            label: "Failed Payments (24h)",
            value: statsLoading ? "..." : `${stats?.failedPayments24h || 0}`,
            trend: stats?.failedPayments24h && stats.failedPayments24h > 0 ? "Needs attention" : "All clear",
            trendDir: stats?.failedPayments24h && stats.failedPayments24h > 0 ? "down" : "success",
          },
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

      {/* Pricing Configuration Cards */}
      <div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
          <span className="material-symbols-outlined" style={{ fontSize: 20, color: "var(--admin-cyan)" }}>tune</span>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: "var(--admin-text)", margin: 0 }}>Pricing Configuration</h3>
          <span className="admin-badge admin-badge--cyan" style={{ fontSize: 10, marginLeft: 4 }}>EDITABLE</span>
        </div>

        {pricingLoading ? (
          <p style={{ color: "var(--admin-text-muted)", fontSize: 13 }}>Loading pricing configuration...</p>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
            <PricingCard
              icon="lock_open"
              title="Workspace Unlock"
              description="Full 12-month access per workspace"
              currentKobo={pricing?.workspaceUnlockKobo || 500000}
              suffix="/ year"
              onSave={(kobo) => savePricing({ workspaceUnlockKobo: kobo })}
              isSaving={updatePricingMutation.isPending}
              saveError={updatePricingMutation.isError ? updatePricingMutation.error?.message : null}
            />
            <CreditsCard
              currentPriceKobo={pricing?.creditPriceKobo || 25000}
              standardCredits={pricing?.standardCredits || 15}
              onSavePrice={(kobo) => savePricing({ creditPriceKobo: kobo })}
              onSaveCredits={(credits) => savePricing({ standardCredits: credits })}
              isSaving={updatePricingMutation.isPending}
              saveError={updatePricingMutation.isError ? updatePricingMutation.error?.message : null}
            />
            <PricingCard
              icon="account_balance"
              title="Additional Bank Account"
              description="Add another bank to a workspace"
              currentKobo={pricing?.bankAccountAddonKobo || 300000}
              suffix="/ account"
              onSave={(kobo) => savePricing({ bankAccountAddonKobo: kobo })}
              isSaving={updatePricingMutation.isPending}
              saveError={updatePricingMutation.isError ? updatePricingMutation.error?.message : null}
            />
          </div>
        )}
      </div>

      {/* Revenue Breakdown */}
      {stats && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
          {[
            { label: "Workspace Unlocks", count: stats.revenueByType.unlock.count, amount: stats.revenueByType.unlock.amountNgn, icon: "lock_open", color: "#22c55e" },
            { label: "Credit Purchases", count: stats.revenueByType.credits.count, amount: stats.revenueByType.credits.amountNgn, icon: "local_activity", color: "var(--admin-cyan)" },
            { label: "Bank Add-ons", count: stats.revenueByType.bankAddon.count, amount: stats.revenueByType.bankAddon.amountNgn, icon: "account_balance", color: "#a855f7" },
          ].map((item) => (
            <div key={item.label} className="admin-card" style={{ display: "flex", alignItems: "center", gap: 14, padding: 16 }}>
              <div style={{
                width: 42,
                height: 42,
                borderRadius: 10,
                background: `${item.color}18`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}>
                <span className="material-symbols-outlined" style={{ fontSize: 20, color: item.color }}>{item.icon}</span>
              </div>
              <div>
                <p style={{ fontSize: 12, color: "var(--admin-text-muted)", margin: 0, fontWeight: 600 }}>{item.label}</p>
                <p style={{ fontSize: 18, fontWeight: 800, color: "var(--admin-text)", margin: "2px 0 0" }}>₦{formatNumber(item.amount)}</p>
                <p style={{ fontSize: 11, color: "var(--admin-text-muted)", margin: "2px 0 0" }}>{item.count} transactions</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Transaction Ledger */}
      <div className="admin-card" style={{ padding: 0, overflow: "hidden" }}>
        <div style={{ padding: "16px 20px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <h3 className="admin-card-title">Transaction Ledger</h3>
            <p style={{ fontSize: 12, color: "var(--admin-text-muted)", margin: "2px 0 0" }}>All Paystack transactions across the platform</p>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <select
              className="admin-select"
              value={txStatusFilter}
              onChange={(e) => {
                setTxStatusFilter(e.target.value);
                setTxCursor(null);
              }}
              style={{ minWidth: 120 }}
            >
              <option value="All">All Statuses</option>
              <option value="success">Success</option>
              <option value="failed">Failed</option>
              <option value="pending">Pending</option>
              <option value="abandoned">Abandoned</option>
            </select>
          </div>
        </div>
        <table className="admin-table">
          <thead>
            <tr>
              <th>Ref / Date</th>
              <th>Customer</th>
              <th>Type</th>
              <th>Amount</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {txLoading ? (
               <tr><td colSpan={5} style={{ textAlign: "center", padding: 20 }}>Loading transactions...</td></tr>
            ) : txData?.items.length === 0 ? (
               <tr><td colSpan={5} style={{ textAlign: "center", padding: 20, color: "var(--admin-text-muted)" }}>No transactions found.</td></tr>
            ) : (
              txData?.items.map((tx: any) => (
                <tr key={tx.id}>
                  <td>
                    <span style={{ fontFamily: "monospace", fontSize: 12 }}>{tx.reference.substring(0, 20)}</span><br/>
                    <span style={{ fontSize: 11, color: "var(--admin-text-muted)" }}>{new Date(tx.createdAt).toLocaleString()}</span>
                  </td>
                  <td>
                    {tx.user?.name || "Unknown"} <br/>
                    <span style={{ fontSize: 11, color: "var(--admin-text-muted)" }}>{tx.user?.email || ""}</span>
                  </td>
                  <td>
                    <span className="admin-badge admin-badge--cyan" style={{ fontSize: 10, textTransform: "uppercase" }}>
                      {(tx.type || "N/A").replace(/_/g, " ")}
                    </span>
                  </td>
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

      {/* Spin animation for sync icon */}
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
