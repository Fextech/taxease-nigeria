"use client";

import { trpc } from "@/lib/trpc";
import Link from "next/link";
import { formatNumber } from "@/lib/utils";

export default function BroadcastPage() {
  const { data, isLoading } = trpc.admin.broadcast.listBroadcasts.useQuery({});

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {/* Action Bar */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: "var(--admin-text)", margin: 0 }}>Broadcast History</h2>
          <p style={{ fontSize: 13, color: "var(--admin-text-muted)", margin: "4px 0 0" }}>View sent, scheduled, and draft broadcasts</p>
        </div>
        <Link href="/broadcast/compose" className="admin-btn admin-btn--primary">
          <span className="material-symbols-outlined" style={{ fontSize: 16 }}>add</span>
          New Broadcast
        </Link>
      </div>

      {/* Table */}
      <div className="admin-card" style={{ padding: 0, overflow: "hidden" }}>
        <table className="admin-table">
          <thead>
            <tr>
              <th>Subject</th>
              <th>Segment</th>
              <th>Channel</th>
              <th>Recipients</th>
              <th>Delivered / Failed / Opened</th>
              <th>Status</th>
              <th>Sent</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={7} style={{ textAlign: "center", padding: 40, color: "var(--admin-text-muted)" }}>
                  Loading broadcasts...
                </td>
              </tr>
            ) : data?.items.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ textAlign: "center", padding: 40, color: "var(--admin-text-muted)" }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 36, opacity: 0.3, display: "block", marginBottom: 8 }}>campaign</span>
                  No broadcasts yet. Create your first broadcast to get started.
                </td>
              </tr>
            ) : (
              data?.items.map((broadcast: any) => (
                <tr key={broadcast.id}>
                  <td style={{ fontWeight: 600 }}>{broadcast.subject}</td>
                  <td>{broadcast.segmentType}</td>
                  <td>{broadcast.channel}</td>
                  <td>{formatNumber(broadcast.totalRecipients)}</td>
                  <td style={{ fontSize: 13, fontFamily: 'monospace' }}>
                    <span style={{ color: "var(--admin-success)" }}>{formatNumber(broadcast.delivered)}</span> / 
                    <span style={{ color: "#ef4444" }}> {formatNumber(broadcast.failed)}</span> / 
                    <span style={{ color: "var(--admin-cyan)" }}> {formatNumber(broadcast.opened)}</span>
                  </td>
                  <td>
                    <span className={`admin-badge ${
                      broadcast.status === 'SENT' ? 'admin-badge--success' : 
                      broadcast.status === 'DRAFT' ? 'admin-badge--muted' : 
                      broadcast.status === 'SCHEDULED' ? 'admin-badge--warning' : 'admin-badge--primary'
                    }`}>
                      {broadcast.status}
                    </span>
                  </td>
                  <td style={{ color: "var(--admin-text-muted)", fontSize: 13 }}>
                    {broadcast.sentAt ? new Date(broadcast.sentAt).toLocaleDateString() : (broadcast.scheduledAt ? new Date(broadcast.scheduledAt).toLocaleDateString() : '-')}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
