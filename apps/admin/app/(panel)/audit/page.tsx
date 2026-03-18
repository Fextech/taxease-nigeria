"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
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

const columnHelper = createColumnHelper<AuditLogItem>();

export default function AuditLogPage() {
  const [filters, setFilters] = useState({
    actionCode: "ALL",
    search: "",
  });

  const { data, isLoading } = trpc.admin.audit.listLogs.useQuery({
    limit: 50,
    actionCode: filters.actionCode,
    search: filters.search || undefined,
  }, { keepPreviousData: true } as any);

  const { mutateAsync: exportLogs, isPending: isExporting } = trpc.admin.audit.exportLogs.useMutation();

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
          <option value="USER_LOGGED_IN">User Logged In</option>
          <option value="USER_SUSPENDED">User Suspended</option>
          <option value="USER_DELETED">User Deleted</option>
          <option value="REVEAL_EMAIL">Email Reveal</option>
          <option value="TICKET_REPLY">Ticket Reply</option>
          <option value="BROADCAST_SENT">Broadcast Sent</option>
          <option value="AUDIT_EXPORT">Audit Export</option>
        </select>
        <div style={{ marginLeft: "auto", fontSize: 13, color: "var(--admin-text-muted)" }}>
          Showing latest {data?.items.length || 0} events
        </div>
      </div>

      {/* Table */}
      <div className="admin-card" style={{ padding: 0, overflow: "hidden" }}>
        {isLoading ? (
          <div style={{ padding: 40, textAlign: "center", color: "var(--admin-text-muted)" }}>Loading audit logs...</div>
        ) : (
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
              {table.getRowModel().rows.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ textAlign: "center", padding: 40, color: "var(--admin-text-muted)" }}>
                    No matching logs found.
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
        )}
      </div>
    </div>
  );
}
