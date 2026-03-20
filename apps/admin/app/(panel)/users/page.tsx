"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { formatNumber } from "@/lib/utils";
import Link from "next/link";
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";

type UserItem = {
  id: string;
  name: string | null;
  email: string;
  plan: string;
  isSuspended: boolean;
  createdAt: Date;
  _count: { workspaces: number };
};

const columnHelper = createColumnHelper<UserItem>();

export default function UsersPage() {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [plan, setPlan] = useState("All");
  const [status, setStatus] = useState("All"); // All, Active, Suspended, Deleted
  const [cursor, setCursor] = useState<string | null>(null);

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newUserName, setNewUserName] = useState("");
  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserPlan, setNewUserPlan] = useState<"FREE" | "PRO">("FREE");
  const [createdAccountInfo, setCreatedAccountInfo] = useState<{ email: string, tempPassword: string } | null>(null);

  const { mutateAsync: createUser, isPending: isCreatingUser } = trpc.admin.users.createUser.useMutation();
  const utils = trpc.useUtils();

  // Debounce search
  useState(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(search);
      setCursor(null); // Reset pagination on search
    }, 300);
    return () => clearTimeout(handler);
  });

  const { data, isLoading } = trpc.admin.users.listUsers.useQuery({
    limit: 20,
    cursor: cursor || undefined,
    search: debouncedSearch || undefined,
    plan: plan !== "All" ? plan : undefined,
    status: status !== "All" ? status : undefined,
  });

  const { mutateAsync: revealEmail } = trpc.admin.users.revealEmail.useMutation();
  const [revealedEmails, setRevealedEmails] = useState<Record<string, string>>({});

  const handleRevealEmail = async (userId: string) => {
    try {
      const res = await revealEmail({ userId });
      setRevealedEmails((prev) => ({ ...prev, [userId]: res.email }));
    } catch (e) {
      alert("Failed to reveal email");
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await createUser({ name: newUserName, email: newUserEmail, plan: newUserPlan });
      setCreatedAccountInfo({ email: newUserEmail, tempPassword: res.tempPassword });
      utils.admin.users.listUsers.invalidate();

      setNewUserName("");
      setNewUserEmail("");
      setNewUserPlan("FREE");
    } catch (err: any) {
      alert(err.message || "Failed to create user");
    }
  };

  const columns = [
    columnHelper.accessor("name", {
      header: "User Details",
      cell: (info) => {
        const name = info.getValue() || "Unknown User";
        const initials = name.substring(0, 2).toUpperCase();
        return (
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div className="admin-sidebar-avatar" style={{ width: 32, height: 32, fontSize: 11 }}>
              {initials}
            </div>
            <span style={{ fontWeight: 600 }}>{name}</span>
          </div>
        );
      },
    }),
    columnHelper.accessor("email", {
      header: "Email",
      cell: (info) => {
        const userId = info.row.original.id;
        const email = revealedEmails[userId] || info.getValue().replace(/(?<=.).(?=[^@]*?.@)/g, "*");
        const isRevealed = !!revealedEmails[userId];

        return (
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ color: "var(--admin-text-muted)", fontFamily: "monospace", fontSize: 12 }}>
              {email}
            </span>
            {!isRevealed && (
              <button
                onClick={() => handleRevealEmail(userId)}
                className="admin-btn admin-btn--ghost admin-btn--sm"
                style={{ padding: 4, height: 24, minWidth: 24 }}
                title="Reveal Email (Audit Logged)"
              >
                <span className="material-symbols-outlined" style={{ fontSize: 14 }}>
                  visibility
                </span>
              </button>
            )}
          </div>
        );
      },
    }),
    columnHelper.accessor("createdAt", {
      header: "Date Joined",
      cell: (info) => new Date(info.getValue()).toLocaleDateString("en-NG", { month: "short", day: "numeric", year: "numeric" }),
    }),
    columnHelper.accessor("plan", {
      header: "Subscription",
      cell: (info) => {
        const hasUnlocked = (info.row.original._count?.workspaces || 0) > 0;
        const dynamicPlan = hasUnlocked ? "PRO" : "FREE";
        return (
          <span className={`admin-badge ${dynamicPlan === "PRO" ? "admin-badge--pro" : "admin-badge--free"}`}>
            {dynamicPlan}
          </span>
        );
      },
    }),
    columnHelper.accessor("isSuspended", {
      header: "Status",
      cell: (info) => {
        const isSusp = info.getValue();
        return (
          <span className={`admin-badge ${!isSusp ? "admin-badge--success" : "admin-badge--warning"}`}>
            {!isSusp ? "Active" : "Suspended"}
          </span>
        );
      },
    }),
    columnHelper.display({
      id: "actions",
      header: "Actions",
      cell: (info) => (
        <Link href={`/users/${info.row.original.id}`}>
          <button className="admin-btn admin-btn--ghost admin-btn--sm">Manage</button>
        </Link>
      ),
    }),
  ];

  const table = useReactTable({
    data: (data?.items as any[]) || [],
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {/* KPI Cards Placeholder */}

      {/* Filters + New User Button */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flex: 1 }}>
          <div className="admin-header-search" style={{ maxWidth: 300 }}>
            <span className="material-symbols-outlined" style={{ fontSize: 18, color: "var(--admin-text-muted)" }}>search</span>
            <input
              type="text"
              placeholder="Search by name, email, or user ID..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <select className="admin-select" value={status} onChange={(e) => { setStatus(e.target.value); setCursor(null); }}>
            <option value="All">Status: All</option>
            <option value="Active">Status: Active</option>
            <option value="Suspended">Status: Suspended</option>
            <option value="Deleted">Status: Deleted</option>
          </select>
          <select className="admin-select" value={plan} onChange={(e) => { setPlan(e.target.value); setCursor(null); }}>
            <option value="All">Plan: All</option>
            <option value="FREE">Plan: FREE</option>
            <option value="PRO">Plan: PRO</option>
          </select>
        </div>
        <button
          className="admin-btn admin-btn--primary"
          onClick={() => setIsAddModalOpen(true)}
        >
          <span className="material-symbols-outlined" style={{ fontSize: 16 }}>person_add</span>
          New User
        </button>
      </div>

      {/* User Table */}
      <div className="admin-card" style={{ padding: 0, overflow: "hidden" }}>
        <table className="admin-table">
          <thead>
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <th key={header.id}>
                    {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={6} style={{ textAlign: "center", padding: 40, color: "var(--admin-text-muted)" }}>
                  Loading users...
                </td>
              </tr>
            ) : table.getRowModel().rows.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ textAlign: "center", padding: 40, color: "var(--admin-text-muted)" }}>
                  No users found matching your filters.
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

        <div className="admin-pagination" style={{ padding: "12px 16px" }}>
          <span style={{ color: "var(--admin-text-muted)", fontSize: 13 }}>
            Showing {data?.items.length || 0} users
          </span>
          <div className="admin-pagination-controls">
            <button
              className="admin-pagination-btn admin-btn--ghost"
              disabled={!data?.nextCursor}
              onClick={() => setCursor(data?.nextCursor || null)}
            >
              Next Page <span className="material-symbols-outlined" style={{ fontSize: 16 }}>chevron_right</span>
            </button>
          </div>
        </div>
      </div>

      {/* Add User Modal */}
      {isAddModalOpen && (
        <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50 }}>
          <div className="admin-card" style={{ width: "100%", maxWidth: 450, padding: 24, boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <h2 style={{ margin: 0, fontSize: 18 }}>Add New User</h2>
              <button
                className="admin-btn admin-btn--ghost admin-btn--sm"
                onClick={() => { setIsAddModalOpen(false); setCreatedAccountInfo(null); }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 20 }}>close</span>
              </button>
            </div>

            {createdAccountInfo ? (
              <div>
                <div style={{ padding: 16, background: "rgba(0,255,100,0.1)", border: "1px solid var(--admin-success)", borderRadius: 8, marginBottom: 20 }}>
                  <p style={{ margin: "0 0 10px", color: "var(--admin-success)", fontWeight: 600 }}>User created successfully!</p>
                  <p style={{ margin: 0, fontSize: 13, color: "var(--admin-text)" }}>
                    <strong>Email:</strong> {createdAccountInfo.email}<br />
                    <strong>Temporary Password:</strong> <code style={{ userSelect: "all", background: "rgba(0,0,0,0.2)", padding: "2px 6px", borderRadius: 4, display: "inline-block", margin: "4px 0" }}>{createdAccountInfo.tempPassword}</code>
                  </p>
                  <p style={{ margin: "10px 0 0", fontSize: 12, color: "var(--admin-text-muted)", lineHeight: 1.4 }}>
                    Please save this password and share it securely with the user. They will use it to log in.
                  </p>
                </div>
                <button
                  className="admin-btn admin-btn--secondary"
                  style={{ width: "100%", justifyContent: "center" }}
                  onClick={() => { setIsAddModalOpen(false); setCreatedAccountInfo(null); }}
                >
                  Close
                </button>
              </div>
            ) : (
              <form onSubmit={handleCreateUser} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                <div>
                  <label style={{ display: "block", fontSize: 13, marginBottom: 6, color: "var(--admin-text-muted)" }}>Full Name</label>
                  <input
                    type="text"
                    required
                    value={newUserName}
                    onChange={e => setNewUserName(e.target.value)}
                    className="admin-input"
                    style={{ width: "100%", padding: "8px 12px", borderRadius: 6, border: "1px solid var(--admin-border)", background: "var(--admin-surface-hover)", color: "var(--admin-text)" }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 13, marginBottom: 6, color: "var(--admin-text-muted)" }}>Email Address</label>
                  <input
                    type="email"
                    required
                    value={newUserEmail}
                    onChange={e => setNewUserEmail(e.target.value)}
                    className="admin-input"
                    style={{ width: "100%", padding: "8px 12px", borderRadius: 6, border: "1px solid var(--admin-border)", background: "var(--admin-surface-hover)", color: "var(--admin-text)" }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 13, marginBottom: 6, color: "var(--admin-text-muted)" }}>Subscription Plan</label>
                  <select
                    value={newUserPlan}
                    onChange={e => setNewUserPlan(e.target.value as any)}
                    className="admin-select"
                    style={{ width: "100%", padding: "8px 12px", borderRadius: 6, border: "1px solid var(--admin-border)", background: "var(--admin-surface-hover)", color: "var(--admin-text)" }}
                  >
                    <option value="FREE">FREE</option>
                    <option value="PRO">PRO</option>
                  </select>
                </div>
                <div style={{ display: "flex", justifyContent: "flex-end", gap: 12, marginTop: 8 }}>
                  <button
                    type="button"
                    className="admin-btn admin-btn--ghost"
                    onClick={() => setIsAddModalOpen(false)}
                    disabled={isCreatingUser}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="admin-btn admin-btn--primary"
                    disabled={isCreatingUser}
                  >
                    {isCreatingUser ? "Creating..." : "Create User"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
