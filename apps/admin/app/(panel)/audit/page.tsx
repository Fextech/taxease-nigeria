"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { format } from "date-fns";
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  createColumnHelper,
} from "@tanstack/react-table";

type AuditLogItem = {
  id: string;
  adminEmail: string | null;
  adminRole: string | null;
  actionCode: string;
  targetEntity: string | null;
  previousValue: any;
  newValue: any;
  ipAddress: string | null;
  createdAt: string | Date;
  admin?: { fullName: string } | null;
};

// Assuming a similar type for UserLogItem, or extending AuditLogItem for user logs
// This type definition is inferred from the provided tbody rendering logic
type UserLogItem = {
  id: string;
  createdAt: string | Date;
  user?: { name: string | null; email: string } | null;
  action: string; // Renamed from actionCode
  entityType: string | null; // Renamed from targetEntity
  entityId: string | null;
  metadata: any; // Corresponds to previousValue/newValue
  // Other fields like ipAddress might be present but not explicitly used in the provided tbody
};


const columnHelper = createColumnHelper<AuditLogItem>();

export default function AuditLogsPage() {
  const [activeTab, setActiveTab] = useState<"ADMIN" | "USER">("ADMIN");

  const [dateRange, setDateRange] = useState<[Date | null, Date | null]>([null, null]);
  const [filters, setFilters] = useState({
    actionCode: "ALL",
    search: "",
  });

  const { data, isLoading, refetch, isRefetching } = trpc.admin.audit.listLogs.useQuery({
    limit: 50,
    actionCode: filters.actionCode,
    search: filters.search || undefined,
  }, { enabled: activeTab === "ADMIN" } as any);

  const { mutateAsync: exportLogs, isPending: isExporting } = trpc.admin.audit.exportLogs.useMutation();

  const { data: userData, isLoading: isUserLoading, refetch: refetchUser, isRefetching: isUserRefetching } = trpc.admin.audit.listUserLogs.useQuery(
    { limit: 100, actionCode: filters.actionCode || undefined, search: filters.search || undefined },
    { enabled: activeTab === "USER" }
  );

  const handleExport = async (format: 'csv' | 'json') => {
    try {
      const res = await exportLogs({ format, actionCode: filters.actionCode });
      const blob = new Blob([res.data], { type: res.mimeType });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `audit-export-${new Date().toISOString().slice(0,10)}.${res.extension}`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (e) {
      alert("Failed to export logs");
    }
  };

  const getActionColor = (code: string) => {
    if (code.includes('DELETE') || code.includes('REVEAL')) return 'var(--admin-error)';
    if (code.includes('SUSPEND') || code.includes('FORCE_LOGOUT')) return 'var(--admin-warning)';
    if (code.includes('CREATE') || code.includes('ADD')) return 'var(--admin-success)';
    return 'var(--admin-cyan)';
  };

  const columns = [
    columnHelper.accessor("createdAt", {
      header: "Timestamp",
      cell: (info) => (
        <span style={{ fontSize: 13, color: "var(--admin-text)" }}>
          {new Date(info.getValue()).toLocaleString()}
        </span>
      ),
    }),
    columnHelper.accessor("adminEmail", {
      header: "Admin / Role",
      cell: (info) => {
        const item = info.row.original;
        return (
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: "var(--admin-text)" }}>
              {item.admin?.fullName || item.adminEmail || "System"}
            </span>
            <span style={{ fontSize: 11, color: "var(--admin-text-muted)" }}>{item.adminRole || "SYSTEM"} · {item.ipAddress || "No IP"}</span>
          </div>
        );
      },
    }),
    columnHelper.accessor("actionCode", {
      header: "Action",
      cell: (info) => (
        <span className="admin-badge" style={{
            backgroundColor: `color-mix(in srgb, ${getActionColor(info.getValue())} 15%, transparent)`,
            color: getActionColor(info.getValue()),
            border: `1px solid color-mix(in srgb, ${getActionColor(info.getValue())} 30%, transparent)`
        }}>
          {info.getValue()}
        </span>
      ),
    }),
    columnHelper.accessor("targetEntity", {
      header: "Target Entity",
      cell: (info) => (
        <span style={{ fontSize: 13, color: "var(--admin-text)", fontFamily: "monospace" }}>
          {info.getValue() || "N/A"}
        </span>
      ),
    }),
    columnHelper.accessor("id", {
      header: "Diff Details",
      cell: (info) => {
        const item = info.row.original;
        const hasDiff = item.previousValue || item.newValue;
        return hasDiff ? (
          <button className="admin-btn admin-btn--ghost admin-btn--sm" onClick={() => alert(JSON.stringify({ prev: item.previousValue, new: item.newValue }, null, 2))}>
            View JSON
          </button>
        ) : (
          <span style={{ fontSize: 12, color: "var(--admin-text-muted)" }}>None</span>
        );
      },
    }),
  ];

  const table = useReactTable({
    data: (data?.items as any[]) || [],
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: "var(--admin-text)", margin: "0 0 8px" }}>Audit Trail</h1>
          <p style={{ color: "var(--admin-text-muted)", margin: 0, fontSize: 14 }}>
            Immutable, sequential record of all administrative actions and system events.
          </p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => handleExport('csv')} disabled={isExporting} className="admin-btn admin-btn--secondary">
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>download</span> CSV Export
          </button>
          <button onClick={() => handleExport('json')} disabled={isExporting} className="admin-btn admin-btn--secondary">
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>data_object</span> JSON Export
          </button>
        </div>
      </div>

      <div style={{ background: "rgba(0, 240, 255, 0.05)", border: "1px solid rgba(0, 240, 255, 0.2)", borderRadius: 8, padding: "12px 16px", display: "flex", alignItems: "center", gap: 12 }}>
          <span className="material-symbols-outlined" style={{ color: "var(--admin-cyan)" }}>shield_person</span>
          <p style={{ margin: 0, fontSize: 13, color: "var(--admin-text)" }}>
              <strong>Compliance Notice:</strong> Logs are immutable and retained for 7 years per regulatory requirements. Export actions are automatically logged.
          </p>
      </div>

      {/* Filters */}
      <div className="admin-card" style={{ display: "flex", gap: 16, alignItems: "center", padding: "16px 20px" }}>
        <input
          type="text"
          placeholder="Search by Target Entity or Email..."
          className="admin-input"
          style={{ width: 300 }}
          value={filters.search}
          onChange={(e) => setFilters({ ...filters, search: e.target.value })}
        />
        <select
          className="admin-input"
          style={{ width: 200 }}
          value={filters.actionCode}
          onChange={(e) => setFilters({ ...filters, actionCode: e.target.value })}
        >
          <option value="ALL">All Actions</option>
          {activeTab === "ADMIN" ? (
            <>
              <option value="USER_LOGGED_IN">User Logged In</option>
              <option value="USER_SUSPENDED">User Suspended</option>
              <option value="USER_DELETED">User Deleted</option>
              <option value="REVEAL_EMAIL">Email Reveal</option>
              <option value="TICKET_REPLY">Ticket Reply</option>
              <option value="BROADCAST_SENT">Broadcast Sent</option>
              <option value="AUDIT_EXPORT">Audit Export</option>
            </>
          ) : (
            <>
              <option value="CREATE">Create Workspace</option>
              <option value="LOCK">Lock Workspace</option>
              <option value="UPLOAD">Upload Statement</option>
              <option value="DELETE">Delete Statement</option>
              <option value="UPSERT">Annotate Transaction</option>
              <option value="BULK_UPSERT">Bulk Annotate</option>
              <option value="GENERATE_REPORT">Generate Report</option>
              <option value="PAYMENT_VERIFIED">Payment Verified</option>
            </>
          )}
        </select>
        <div style={{ marginLeft: "auto", fontSize: 13, color: "var(--admin-text-muted)" }}>
          Showing latest {activeTab === "ADMIN" ? data?.items.length : userData?.items.length || 0} events
        </div>
      </div>

      <div className="audit-tabs" style={{ display: 'flex', gap: '20px', marginBottom: '20px', borderBottom: '1px solid var(--admin-border)' }}>
        <button
          onClick={() => {
            setActiveTab("ADMIN");
            setFilters(prev => ({ ...prev, actionCode: "ALL" }));
          }}
          style={{
            padding: '10px 16px',
            background: 'none',
            border: 'none',
            borderBottom: activeTab === "ADMIN" ? '2px solid var(--te-primary)' : '2px solid transparent',
            color: activeTab === "ADMIN" ? 'var(--te-primary)' : 'var(--admin-text-muted)',
            fontWeight: activeTab === "ADMIN" ? 600 : 500,
            cursor: 'pointer',
            fontSize: '14px'
          }}
        >
          Administrative Actions
        </button>
        <button
          onClick={() => {
            setActiveTab("USER");
            setFilters(prev => ({ ...prev, actionCode: "ALL" }));
          }}
          style={{
            padding: '10px 16px',
            background: 'none',
            border: 'none',
            borderBottom: activeTab === "USER" ? '2px solid var(--te-primary)' : '2px solid transparent',
            color: activeTab === "USER" ? 'var(--te-primary)' : 'var(--admin-text-muted)',
            fontWeight: activeTab === "USER" ? 600 : 500,
            cursor: 'pointer',
            fontSize: '14px'
          }}
        >
          User Activity
        </button>
      </div>

      {/* Table */}
      <div className="admin-card" style={{ padding: 0, overflow: "hidden" }}>
        {activeTab === "ADMIN" ? (
          <table className="admin-table">
            <thead>
              {table.getHeaderGroups().map((headerGroup) => (
                <tr key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <th key={header.id}>
                      {header.isPlaceholder
                        ? null
                        : flexRender(header.column.columnDef.header, header.getContext())}
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody>
              {isLoading || isRefetching ? (
                <tr>
                  <td colSpan={5} style={{ textAlign: "center", padding: "40px" }}>
                    <span className="material-symbols-outlined status-spin" style={{ fontSize: 24, color: "var(--te-primary)" }}>sync</span>
                    <p style={{ marginTop: 8, color: "var(--admin-text-muted)" }}>Loading admin audit records...</p>
                  </td>
                </tr>
              ) : table.getRowModel().rows.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ textAlign: "center", padding: 40, color: "var(--admin-text-muted)" }}>
                    No matching admin logs found.
                  </td>
                </tr>
              ) : (
                table.getRowModel().rows.map((row) => (
                  <tr key={row.id}>
                    {row.getVisibleCells().map((cell) => (
                      <td key={cell.id}>
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        ) : (
          <table className="admin-table">
            <thead>
              <tr>
                <th>Date & Time</th>
                <th>User</th>
                <th>Action</th>
                <th>Entity</th>
                <th>Details</th>
              </tr>
            </thead>
            <tbody>
              {isUserLoading || isUserRefetching ? (
                <tr>
                  <td colSpan={5} style={{ textAlign: "center", padding: "40px" }}>
                    <span className="material-symbols-outlined status-spin" style={{ fontSize: 24, color: "var(--te-primary)" }}>sync</span>
                    <p style={{ marginTop: 8, color: "var(--admin-text-muted)" }}>Loading user activity records...</p>
                  </td>
                </tr>
              ) : !userData?.items || userData.items.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ textAlign: "center", padding: 40, color: "var(--admin-text-muted)" }}>
                    No matching user activity found.
                  </td>
                </tr>
              ) : (
                userData.items.map((log: any) => (
                  <tr key={log.id}>
                    <td>
                      {format(new Date(log.createdAt), "MMM d, yyyy")}
                      <div style={{ fontSize: 11, color: "var(--admin-text-muted)" }}>{format(new Date(log.createdAt), "h:mm a")}</div>
                    </td>
                    <td>
                      {log.user ? (
                        <>
                          <div style={{ fontWeight: 500 }}>{log.user.name || "Unknown"}</div>
                          <div style={{ fontSize: 11, color: "var(--admin-text-muted)" }}>{log.user.email}</div>
                        </>
                      ) : (
                        <span style={{ color: "var(--admin-text-muted)" }}>System</span>
                      )}
                    </td>
                    <td>
                      <span className="audit-action-badge">{log.action}</span>
                    </td>
                    <td>
                      <span style={{ fontFamily: "monospace", fontSize: 12, background: "var(--admin-bg)", padding: "2px 6px", borderRadius: 4, border: "1px solid var(--admin-border)" }}>
                        {log.entityType} {log.entityId ? `(#${log.entityId.slice(-6)})` : ''}
                      </span>
                    </td>
                    <td>
                      <div style={{ fontSize: 12, color: "var(--admin-text-muted)", maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {log.metadata ? JSON.stringify(log.metadata) : "—"}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
