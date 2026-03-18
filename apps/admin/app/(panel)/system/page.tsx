"use client";

import { trpc } from "@/lib/trpc";
import { formatNumber } from "@/lib/utils";
import Link from "next/link";

export default function SystemHealthPage() {
  const { data: deployment } = trpc.admin.system.getDeploymentInfo.useQuery();
  const { data: statuses, isLoading: statusesLoading } = trpc.admin.system.getServiceStatuses.useQuery(undefined, { refetchInterval: 10000 });
  const { data: queueStats, isLoading: queueLoading } = trpc.admin.system.getJobQueueStats.useQuery(undefined, { refetchInterval: 5000 });
  const { data: errors } = trpc.admin.system.getRecentErrors.useQuery();

  const getStatusColor = (status: string) => {
    switch(status) {
      case 'operational': return 'var(--admin-success)';
      case 'degraded': return 'var(--admin-warning)';
      case 'down': return 'var(--admin-error)';
      default: return 'var(--admin-text-muted)';
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: "var(--admin-text)", margin: "0 0 8px" }}>System Health</h1>
          <p style={{ color: "var(--admin-text-muted)", margin: 0, fontSize: 13, display: "flex", alignItems: "center", gap: 8 }}>
            <span className="admin-badge admin-badge--pro">{deployment?.environment?.toUpperCase() || "PROD"}</span>
            Version: {deployment?.version} ({deployment?.commitHash})
            <span style={{ opacity: 0.5 }}>|</span>
            Last deployed: {deployment ? new Date(deployment.lastDeployed).toLocaleDateString() : "..."}
          </p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="admin-btn admin-btn--secondary">
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>refresh</span> Refresh All
          </button>
        </div>
      </div>

      {/* Top Metrics */}
      <div className="admin-kpi-grid" style={{ gridTemplateColumns: "repeat(4, 1fr)" }}>
        <div className="admin-kpi-card">
          <p className="admin-kpi-label">System Uptime</p>
          <p className="admin-kpi-value">99.98%</p>
          <div className="admin-kpi-trend admin-kpi-trend--success">Operational</div>
        </div>
        <div className="admin-kpi-card">
          <p className="admin-kpi-label">Avg Response Time</p>
          <p className="admin-kpi-value">124ms</p>
          <div className="admin-kpi-trend admin-kpi-trend--down">-12ms</div>
        </div>
        <div className="admin-kpi-card">
          <p className="admin-kpi-label">Active Users (15m)</p>
          <p className="admin-kpi-value">342</p>
          <div className="admin-kpi-trend admin-kpi-trend--up">+5.2%</div>
        </div>
        <div className="admin-kpi-card">
          <p className="admin-kpi-label">Server Load</p>
          <p className="admin-kpi-value" style={{ color: "var(--admin-warning)" }}>68%</p>
          <div className="admin-kpi-trend admin-kpi-trend--up">Peak Hours</div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 24 }}>
        {/* Left Column */}
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          {/* Service Mesh */}
          <div className="admin-card">
            <h3 className="admin-card-title" style={{ marginBottom: 16 }}>Service Mesh Overview</h3>
            {statusesLoading ? (
              <p style={{ color: "var(--admin-text-muted)", textAlign: "center", padding: 20 }}>Pinging services...</p>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 12 }}>
                {statuses?.map(s => (
                  <div key={s.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", background: "var(--admin-surface-hover)", borderRadius: 8, border: "1px solid var(--admin-border)" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <div style={{ width: 8, height: 8, borderRadius: "50%", background: getStatusColor(s.status), boxShadow: `0 0 8px ${getStatusColor(s.status)}` }} />
                      <div>
                        <p style={{ fontSize: 13, fontWeight: 600, color: "var(--admin-text)", margin: 0 }}>{s.name}</p>
                        <p style={{ fontSize: 11, color: "var(--admin-text-muted)", margin: 0, textTransform: "capitalize" }}>{s.type}</p>
                      </div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <p style={{ fontSize: 12, color: s.ping > 500 ? "var(--admin-warning)" : "var(--admin-text)", margin: 0, fontFamily: "monospace" }}>{s.ping}ms</p>
                      <p style={{ fontSize: 11, color: getStatusColor(s.status), margin: 0, textTransform: "capitalize" }}>{s.status}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Error Log Viewer */}
          <div className="admin-card" style={{ flex: 1 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h3 className="admin-card-title">Recent Critical Errors</h3>
              <Link href="#" className="admin-btn admin-btn--ghost admin-btn--sm">View in Sentry <span className="material-symbols-outlined" style={{ fontSize: 14 }}>open_in_new</span></Link>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {errors?.map(err => (
                <div key={err.id} style={{ display: "flex", gap: 16, padding: "12px", background: "rgba(239, 68, 68, 0.05)", borderLeft: "2px solid var(--admin-error)", borderRadius: "0 6px 6px 0" }}>
                  <span className="material-symbols-outlined" style={{ color: "var(--admin-error)", fontSize: 18 }}>error</span>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: 13, fontWeight: 700, color: "var(--admin-text)", margin: "0 0 4px" }}>[{err.service}] {err.message}</p>
                    <p style={{ fontSize: 11, color: "var(--admin-text-muted)", margin: 0 }}>{new Date(err.time).toLocaleTimeString()}</p>
                  </div>
                </div>
              ))}
              {errors?.length === 0 && <p style={{ color: "var(--admin-text-muted)", fontSize: 13 }}>No critical errors recently.</p>}
            </div>
          </div>
        </div>

        {/* Right Column */}
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          {/* BullMQ Job Queue */}
          <div className="admin-card">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h3 className="admin-card-title">Job Queue (BullMQ)</h3>
              <span className="admin-badge admin-badge--pro">Processing</span>
            </div>
            
            {queueLoading ? (
              <p style={{ color: "var(--admin-text-muted)", fontSize: 13 }}>Fetching queue depth...</p>
            ) : (
              <>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                  <span style={{ fontSize: 12, color: "var(--admin-text-muted)" }}>Current Batch Progress</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: "var(--admin-cyan)" }}>{queueStats?.progressPercent}%</span>
                </div>
                <div style={{ width: "100%", height: 6, background: "var(--admin-surface-hover)", borderRadius: 3, marginBottom: 24, overflow: "hidden" }}>
                  <div style={{ width: `${queueStats?.progressPercent}%`, height: "100%", background: "var(--admin-cyan)", borderRadius: 3 }} />
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 20 }}>
                  <div style={{ padding: 12, border: "1px solid var(--admin-border)", borderRadius: 8 }}>
                    <p style={{ fontSize: 11, color: "var(--admin-text-muted)", margin: "0 0 4px", textTransform: "uppercase" }}>Active</p>
                    <p style={{ fontSize: 20, fontWeight: 700, color: "var(--admin-cyan)", margin: 0 }}>{formatNumber(queueStats?.active || 0)}</p>
                  </div>
                  <div style={{ padding: 12, border: "1px solid var(--admin-border)", borderRadius: 8 }}>
                    <p style={{ fontSize: 11, color: "var(--admin-text-muted)", margin: "0 0 4px", textTransform: "uppercase" }}>Waiting</p>
                    <p style={{ fontSize: 20, fontWeight: 700, color: "var(--admin-text)", margin: 0 }}>{formatNumber(queueStats?.waiting || 0)}</p>
                  </div>
                  <div style={{ padding: 12, border: "1px solid var(--admin-border)", borderRadius: 8 }}>
                    <p style={{ fontSize: 11, color: "var(--admin-text-muted)", margin: "0 0 4px", textTransform: "uppercase" }}>Failed</p>
                    <p style={{ fontSize: 20, fontWeight: 700, color: "var(--admin-error)", margin: 0 }}>{formatNumber(queueStats?.failed || 0)}</p>
                  </div>
                  <div style={{ padding: 12, border: "1px solid var(--admin-border)", borderRadius: 8 }}>
                    <p style={{ fontSize: 11, color: "var(--admin-text-muted)", margin: "0 0 4px", textTransform: "uppercase" }}>Completed</p>
                    <p style={{ fontSize: 20, fontWeight: 700, color: "var(--admin-success)", margin: 0 }}>{formatNumber(queueStats?.completed || 0)}</p>
                  </div>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <button className="admin-btn admin-btn--secondary" style={{ width: "100%", justifyContent: "center" }}>Open BullBoard Dashboard</button>
                  <button className="admin-btn admin-btn--danger" style={{ width: "100%", justifyContent: "center" }} disabled>Flush Failed Jobs</button>
                </div>
              </>
            )}
          </div>
          
          {/* Quick Actions */}
          <div className="admin-card" style={{ borderColor: "rgba(0,240,255,0.2)" }}>
             <h3 className="admin-card-title" style={{ marginBottom: 12 }}>Infrastructure Actions</h3>
             <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 4 }}>
               <li><button className="admin-sidebar-link" style={{ width: "100%", fontSize: 13 }}><span className="material-symbols-outlined" style={{ fontSize: 16 }}>restart_alt</span> Restart Worker Pool</button></li>
               <li><button className="admin-sidebar-link" style={{ width: "100%", fontSize: 13 }}><span className="material-symbols-outlined" style={{ fontSize: 16 }}>memory</span> Clear Redis Cache</button></li>
               <li><button className="admin-sidebar-link" style={{ width: "100%", fontSize: 13 }}><span className="material-symbols-outlined" style={{ fontSize: 16 }}>sync</span> Sync Paystack Plans</button></li>
             </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
