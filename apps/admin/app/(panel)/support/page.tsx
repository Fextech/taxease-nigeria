"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { formatNumber } from "@/lib/utils";
import Link from "next/link";

const FILTERS = [
  { id: "all", label: "All Tickets" },
  { id: "mine", label: "My Assignments" },
  { id: "overdue", label: "Overdue" },
  { id: "resolved", label: "Resolved" },
];

const PRIORITIES = ["Urgent", "High", "Medium", "Low"];
const CATEGORIES = ["Billing", "Parsing Error", "Account", "Filing Question", "Feature Request", "Other"];

export default function SupportPage() {
  const [activeFilter, setActiveFilter] = useState<"all" | "mine" | "overdue" | "resolved">("all");
  const [selectedPriorities, setSelectedPriorities] = useState<string[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [ticketCursor, setTicketCursor] = useState<string | null>(null);

  const { data: stats, isLoading: statsLoading } = trpc.admin.support.getSupportStats.useQuery();
  
  const { data: ticketData, isLoading: ticketsLoading } = trpc.admin.support.listTickets.useQuery({
    limit: 15,
    cursor: ticketCursor || undefined,
    filter: activeFilter,
    priorities: selectedPriorities,
    categories: selectedCategories
  });

  const togglePriority = (p: string) => {
    setSelectedPriorities(prev => prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p]);
    setTicketCursor(null);
  };
  
  const toggleCategory = (c: string) => {
    setSelectedCategories(prev => prev.includes(c) ? prev.filter(x => x !== c) : [...prev, c]);
    setTicketCursor(null);
  };

  return (
    <div style={{ display: "flex", gap: 20 }}>
      {/* Left Sidebar */}
      <div style={{ width: 200, flexShrink: 0 }}>
        <p className="admin-kpi-label" style={{ marginBottom: 8 }}>Support Filters</p>
        {FILTERS.map((f) => (
          <button
            key={f.id}
            onClick={() => { setActiveFilter(f.id as any); setTicketCursor(null); }}
            className={`admin-sidebar-link ${activeFilter === f.id ? "admin-sidebar-link--active" : ""}`}
            style={{ width: "100%", fontSize: 13, padding: "8px 12px" }}
          >
            {f.label}
          </button>
        ))}

        <p className="admin-kpi-label" style={{ marginTop: 20, marginBottom: 8 }}>By Priority</p>
        {PRIORITIES.map((p) => (
          <label key={p} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 12px", fontSize: 13, color: "var(--admin-text-secondary)", cursor: "pointer" }}>
            <input 
              type="checkbox" 
              checked={selectedPriorities.includes(p)}
              onChange={() => togglePriority(p)}
            /> {p}
          </label>
        ))}

        <p className="admin-kpi-label" style={{ marginTop: 20, marginBottom: 8 }}>By Category</p>
        {CATEGORIES.map((c) => (
          <label key={c} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 12px", fontSize: 13, color: "var(--admin-text-secondary)", cursor: "pointer" }}>
            <input 
              type="checkbox" 
              checked={selectedCategories.includes(c)}
              onChange={() => toggleCategory(c)}
            /> {c}
          </label>
        ))}
      </div>

      {/* Main Content */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 20 }}>
        {/* KPI Cards */}
        <div className="admin-kpi-grid" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
          <div className="admin-kpi-card">
            <p className="admin-kpi-label">Open Tickets</p>
            <p className="admin-kpi-value">{statsLoading ? "..." : formatNumber(stats?.openCount || 0)}</p>
            <div className="admin-kpi-trend admin-kpi-trend--down">-4.1%</div>
          </div>
          <div className="admin-kpi-card">
            <p className="admin-kpi-label">Overdue Tickets</p>
            <p className="admin-kpi-value" style={{ color: stats?.overdueCount ? "var(--admin-error)" : "var(--admin-success)" }}>
              {statsLoading ? "..." : formatNumber(stats?.overdueCount || 0)}
            </p>
            <div className="admin-kpi-trend admin-kpi-trend--down">-2%</div>
          </div>
          <div className="admin-kpi-card">
            <p className="admin-kpi-label">Avg Resolution Time</p>
            <p className="admin-kpi-value">{statsLoading ? "..." : `${stats?.avgResolutionTimeHours}h`}</p>
            <div className="admin-kpi-trend admin-kpi-trend--up">~10%</div>
          </div>
        </div>

        {/* Ticket Queue */}
        <div className="admin-card" style={{ padding: 0, overflow: "hidden" }}>
          <div style={{ padding: "16px 20px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h3 className="admin-card-title">Ticket Queue</h3>
            <div style={{ display: "flex", gap: 8 }}>
              <button className="admin-btn admin-btn--secondary admin-btn--sm">
                <span className="material-symbols-outlined" style={{ fontSize: 14 }}>filter_list</span> Filter
              </button>
              <button className="admin-btn admin-btn--secondary admin-btn--sm">
                <span className="material-symbols-outlined" style={{ fontSize: 14 }}>download</span> Export
              </button>
            </div>
          </div>
          <table className="admin-table">
            <thead>
              <tr><th>Ticket ID</th><th>User</th><th>Subject</th><th>Category</th><th>Priority</th><th>Status</th><th>Action</th></tr>
            </thead>
            <tbody>
              {ticketsLoading ? (
                <tr><td colSpan={7} style={{ textAlign: "center", padding: 20 }}>Loading tickets...</td></tr>
              ) : ticketData?.items.length === 0 ? (
                <tr><td colSpan={7} style={{ textAlign: "center", padding: 20 }}>No tickets found matching priority/category filters.</td></tr>
              ) : (
                ticketData?.items.map((t: any) => (
                  <tr key={t.id}>
                    <td style={{ fontFamily: "monospace", fontSize: 12 }}>{t.id.substring(0, 16)}</td>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <div className="admin-sidebar-avatar" style={{ width: 28, height: 28, fontSize: 10 }}>
                          {t.user.name.charAt(0)}
                        </div>
                        {t.user.name}
                      </div>
                    </td>
                    <td style={{ maxWidth: 250, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                       {t.subject}
                    </td>
                    <td><span className="admin-badge admin-badge--info">{t.category}</span></td>
                    <td>
                      <span className={`admin-badge ${t.priority === "URGENT" ? "admin-badge--error" : t.priority === "HIGH" ? "admin-badge--warning" : "admin-badge--muted"}`}>
                        {t.priority}
                      </span>
                    </td>
                    <td>
                      <span className={`admin-badge ${t.status === "OPEN" ? "admin-badge--cyan" : t.status === "RESOLVED" || t.status === "CLOSED" ? "admin-badge--success" : "admin-badge--warning"}`}>
                        {t.status}
                      </span>
                    </td>
                    <td>
                      <Link href={`/support/${t.id}`} className="admin-btn admin-btn--ghost admin-btn--sm">
                        View <span className="material-symbols-outlined" style={{ fontSize: 14 }}>arrow_forward</span>
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
          <div className="admin-pagination" style={{ padding: "12px 16px" }}>
            <span style={{ color: "var(--admin-text-muted)", fontSize: 13 }}>
              Showing {ticketData?.items.length || 0} tickets
            </span>
            <div className="admin-pagination-controls">
              <button
                className="admin-pagination-btn admin-btn--ghost"
                disabled={!ticketData?.nextCursor}
                onClick={() => setTicketCursor(ticketData?.nextCursor || null)}
              >
                Next Page <span className="material-symbols-outlined" style={{ fontSize: 16 }}>chevron_right</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
