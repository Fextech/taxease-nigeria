"use client";

import { trpc } from "@/lib/trpc";
import { formatNumber, formatNGN } from "@/lib/utils";

export default function DashboardPage() {
  const { data: kpis, isLoading: isKpisLoading } = trpc.admin.dashboard.getKpis.useQuery();
  const { data: chartData, isLoading: isChartLoading } = trpc.admin.dashboard.getChartData.useQuery();
  const { data: activityData, isLoading: isActivityLoading } = trpc.admin.dashboard.getActivityFeed.useQuery(undefined, {
    refetchInterval: 5000, // Poll every 5s for "Live" effect
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {/* Quick Actions Bar */}
      <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
        <button className="admin-btn admin-btn--primary" style={{ gap: 8 }}>
          <span className="material-symbols-outlined" style={{ fontSize: 18 }}>search</span>
          Search Users
        </button>
        <button className="admin-btn admin-btn--ghost" style={{ gap: 8, background: "var(--admin-surface)", border: "1px solid var(--admin-border)" }}>
          <span className="material-symbols-outlined" style={{ fontSize: 18 }}>campaign</span>
          New Broadcast
        </button>
        <button className="admin-btn admin-btn--ghost" style={{ gap: 8, background: "var(--admin-surface)", border: "1px solid var(--admin-border)" }}>
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
          <h2 className="admin-card-title">Subscription Growth</h2>
          <div style={{ padding: "40px 0", textAlign: "center", color: "var(--admin-text-muted)", fontSize: 13 }}>
            <span className="material-symbols-outlined" style={{ fontSize: 36, opacity: 0.3, display: "block", marginBottom: 8 }}>
              bar_chart
            </span>
            Chart renders with live data when API is connected
          </div>
        </div>

        <div className="admin-card">
          <h2 className="admin-card-title">Top Regions (Lagos, Abuja, PH)</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 16 }}>
            {[
              { region: "Lagos State", pct: 58 },
              { region: "Abuja (FCT)", pct: 24 },
              { region: "Rivers State", pct: 12 },
            ].map((r) => (
              <div key={r.region} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <span style={{ fontSize: 13, color: "var(--admin-text)", width: 120 }}>{r.region}</span>
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
            ))}
          </div>
        </div>
      </div>

      {/* Server Status Bar */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: "12px 16px",
          background: "var(--admin-surface)",
          borderRadius: "var(--admin-radius)",
          border: "1px solid var(--admin-border)",
          fontSize: 12,
        }}
      >
        <span className="material-symbols-outlined" style={{ fontSize: 16, color: "var(--admin-success)" }}>
          dns
        </span>
        <span style={{ fontWeight: 600, color: "var(--admin-text)" }}>SERVER STATUS</span>
        <span style={{ color: "var(--admin-text-muted)" }}>LAG05-001</span>
        <span style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 6 }}>
          <span className="admin-status-dot admin-status-dot--online" />
          <span style={{ color: "var(--admin-success)", fontWeight: 600 }}>OPERATIONAL</span>
        </span>
      </div>
    </div>
  );
}
