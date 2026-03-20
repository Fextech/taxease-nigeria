"use client";

import { trpc } from "@/lib/trpc";
import { formatNumber, formatNGN } from "@/lib/utils";
import { useRouter } from "next/navigation";

export default function DashboardPage() {
  const router = useRouter();  
  const { data: kpis, isLoading: isKpisLoading } = trpc.admin.dashboard.getKpis.useQuery();
  const { data: chartData, isLoading: isChartLoading } = trpc.admin.dashboard.getChartData.useQuery();
  const { data: topRegions, isLoading: isRegionsLoading } = trpc.admin.dashboard.getTopRegions.useQuery();
  const { data: activityData, isLoading: isActivityLoading } = trpc.admin.dashboard.getActivityFeed.useQuery(undefined, {
    refetchInterval: 5000, // Poll every 5s for "Live" effect
  });

  const maxPayment = chartData?.payments ? Math.max(
    1,
    ...chartData.payments.workspaceUnlocks,
    ...chartData.payments.creditPurchases,
    ...chartData.payments.bankAddons
  ) : 1;

  const renderLine = (data: number[], color: string) => {
    if (!data || data.length === 0) return null;
    const w = 400; // viewbox width
    const h = 80;  // viewbox height
    const xStep = w / Math.max(data.length - 1, 1);
    
    const points = data.map((val, i) => {
        const x = i * xStep;
        const y = h - (val / maxPayment) * h;
        return `${x},${y}`;
    }).join(' ');

    return (
        <polyline
            fill="none"
            stroke={color}
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
            points={points}
        />
    );
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {/* Quick Actions Bar */}
      <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
        <button className="admin-btn admin-btn--primary" style={{ gap: 8 }}>
          <span className="material-symbols-outlined" style={{ fontSize: 18 }}>search</span>
          Search Users
        </button>
        <button onClick={() => router.push('/broadcast/compose')} className="admin-btn admin-btn--ghost" style={{ gap: 8, background: "var(--admin-surface)", border: "1px solid var(--admin-border)" }}>
          <span className="material-symbols-outlined" style={{ fontSize: 18 }}>campaign</span>
          New Broadcast
        </button>
        <button onClick={() => router.push('/support')} className="admin-btn admin-btn--ghost" style={{ gap: 8, background: "var(--admin-surface)", border: "1px solid var(--admin-border)" }}>
          <span className="material-symbols-outlined" style={{ fontSize: 18 }}>support_agent</span>
          Open Tickets
        </button>
        <button className="admin-btn admin-btn--ghost" style={{ marginLeft: "auto", gap: 8 }}>
          <span className="material-symbols-outlined" style={{ fontSize: 18 }}>download</span>
          Daily Summary PDF
        </button>
      </div>

      {/* KPI Cards */}
      <div className="admin-kpi-grid" style={{ gridTemplateColumns: "repeat(5, 1fr)" }}>
        {isKpisLoading ? (
            Array(5).fill(0).map((_, i) => (
              <div key={i} className="admin-kpi-card" style={{ height: 104, opacity: 0.5, animation: "pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite" }}></div>
            ))
        ) : kpis?.map((kpi) => (
          <div key={kpi.label} className="admin-kpi-card">
            <p className="admin-kpi-label">{kpi.label}</p>
            <p className="admin-kpi-value" style={kpi.label === "Parse Error Rate" ? { color: "var(--admin-success)" } : {}}>
              {kpi.value}
            </p>
            <div className={`admin-kpi-trend admin-kpi-trend--${kpi.trendDir}`}>
              <span className="material-symbols-outlined" style={{ fontSize: 14 }}>
                {kpi.trendDir === "up" ? "trending_up" : "trending_down"}
              </span>
              {kpi.trend}
            </div>
          </div>
        ))}
      </div>

      {/* Charts Row */}
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 20 }}>
        {/* User Growth Chart */}
        <div className="admin-card">
          <div className="admin-card-header">
            <div>
              <h2 className="admin-card-title">User Growth Analysis</h2>
              <p className="admin-card-subtitle">Monthly user acquisition across Nigeria</p>
            </div>
            <div style={{ display: "flex", gap: 4 }}>
              {["Week", "Month", "Year"].map((period) => (
                <button
                  key={period}
                  className={`admin-btn admin-btn--sm ${period === "Month" ? "admin-btn--primary" : "admin-btn--ghost"}`}
                >
                  {period}
                </button>
              ))}
            </div>
          </div>

          {/* Bar Chart */}
          <div
            style={{
              display: "flex",
              alignItems: "flex-end",
              gap: 16,
              height: 220,
              paddingTop: 20,
              borderBottom: "1px solid var(--admin-border)",
            }}
          >
            {isChartLoading ? (
              <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--admin-text-muted)' }}>Loading chart...</div>
            ) : chartData?.months.map((month, i) => (
              <div
                key={month}
                style={{
                  flex: 1,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 12,
                  height: "100%",
                }}
              >
                <div
                  style={{
                    width: 40,
                    height: "100%",
                    background: "var(--admin-surface-hover)",
                    borderRadius: 6,
                    display: "flex",
                    alignItems: "flex-end",
                  }}
                >
                  <div
                    style={{
                      width: "100%",
                      height: `${chartData.barHeights[i]}%`,
                      borderRadius: 6,
                      background: "linear-gradient(180deg, var(--admin-cyan), rgba(0, 240, 255, 0.4))",
                      transition: "height 0.6s cubic-bezier(0.4, 0, 0.2, 1)",
                    }}
                  />
                </div>
                <span style={{ fontSize: 11, fontWeight: 600, color: "var(--admin-text-muted)" }}>
                  {month}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Live Activity */}
        <div className="admin-card">
          <div className="admin-card-header">
            <h2 className="admin-card-title">Live Activity</h2>
            <span className="admin-badge admin-badge--cyan" style={{ fontSize: 10, fontWeight: 700 }}>
              REAL-TIME
            </span>
          </div>

          <div className="admin-activity-feed">
            {isActivityLoading ? (
                <div style={{ padding: 20, textAlign: 'center', color: 'var(--admin-text-muted)' }}>Loading activity...</div>
            ) : activityData?.map((item, i) => (
              <div key={i} className="admin-activity-item">
                <div
                  className="admin-activity-icon"
                  style={{ background: `${item.color}22`, color: item.color }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
                    {item.icon}
                  </span>
                </div>
                <div className="admin-activity-content">
                  <p className="admin-activity-title">{item.title}</p>
                  <p className="admin-activity-desc">{item.desc}</p>
                </div>
                <span className="admin-activity-time">{item.time}</span>
              </div>
            ))}
          </div>

          <button
            className="admin-btn admin-btn--ghost"
            style={{ width: "100%", justifyContent: "center", marginTop: 12 }}
          >
            View All Activities
          </button>
        </div>
      </div>

      {/* Bottom Row */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
        <div className="admin-card">
          <div className="admin-card-header">
            <h2 className="admin-card-title">Payment Growth (Live)</h2>
            <div style={{ display: "flex", gap: 12, fontSize: 11, fontWeight: 600 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <div style={{ width: 8, height: 8, borderRadius: 4, background: "#10b981" }} /> Full Asset
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <div style={{ width: 8, height: 8, borderRadius: 4, background: "var(--admin-cyan)" }} /> Credits
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <div style={{ width: 8, height: 8, borderRadius: 4, background: "#8b5cf6" }} /> Add-ons
              </div>
            </div>
          </div>
          <div style={{ padding: "20px 0 0", height: 120, position: "relative" }}>
            {isChartLoading || !chartData ? (
               <div style={{ textAlign: "center", color: "var(--admin-text-muted)", marginTop: 40 }}>Loading chart...</div>
            ) : (
              <svg width="100%" height="100%" viewBox="0 0 400 80" preserveAspectRatio="none" style={{ overflow: "visible" }}>
                {renderLine(chartData.payments.workspaceUnlocks, "#10b981")}
                {renderLine(chartData.payments.creditPurchases, "var(--admin-cyan)")}
                {renderLine(chartData.payments.bankAddons, "#8b5cf6")}
              </svg>
            )}
            {/* X-axis labels */}
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 12 }}>
              {chartData?.months.map(m => (
                <span key={m} style={{ fontSize: 10, color: "var(--admin-text-muted)", fontWeight: 600 }}>{m}</span>
              ))}
            </div>
          </div>
        </div>

        <div className="admin-card">
          <h2 className="admin-card-title">Top Regions by State</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 16 }}>
            {isRegionsLoading ? (
               <div style={{ textAlign: "center", color: "var(--admin-text-muted)", padding: 20 }}>Loading regions...</div>
            ) : (!topRegions || topRegions.length === 0) ? (
               <div style={{ textAlign: "center", color: "var(--admin-text-muted)", padding: 20 }}>No regional data available yet.</div>
            ) : (
              topRegions.map((r) => (
                <div key={r.region} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <span style={{ fontSize: 13, color: "var(--admin-text)", width: 120, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.region}</span>
                  <div style={{ flex: 1, height: 8, background: "var(--admin-surface-hover)", borderRadius: 4, overflow: "hidden" }}>
                    <div
                      style={{
                        width: `${r.pct}%`,
                        height: "100%",
                        background: "var(--admin-cyan)",
                        borderRadius: 4,
                        transition: "width 0.6s",
                      }}
                    />
                  </div>
                  <span style={{ fontSize: 13, fontWeight: 600, color: "var(--admin-cyan)", width: 40, textAlign: "right" }}>
                    {r.pct}%
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

    </div>
  );
}
