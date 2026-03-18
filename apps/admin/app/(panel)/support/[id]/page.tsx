"use client";

import { useState, use } from "react";
import { trpc } from "@/lib/trpc";
import { useRouter } from "next/navigation";

export default function SupportTicketDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const router = useRouter();

  const [replyBody, setReplyBody] = useState("");
  const [isInternal, setIsInternal] = useState(false);

  const { data, isLoading, refetch } = trpc.admin.support.getTicketDetails.useQuery({ ticketId: resolvedParams.id });
  const { mutateAsync: replyMutation, isPending: isReplying } = trpc.admin.support.replyToTicket.useMutation();
  const { mutateAsync: statusMutation, isPending: isStatusUpdating } = trpc.admin.support.updateTicketStatus.useMutation();

  if (isLoading) return <p style={{ color: "var(--admin-text)" }}>Loading ticket...</p>;
  if (!data) return <p style={{ color: "var(--admin-error)" }}>Ticket not found.</p>;

  const { ticket, user } = data;

  const handleReply = async (markResolved: boolean) => {
    if (!replyBody.trim()) return;
    try {
      await replyMutation({
        ticketId: ticket.id,
        body: replyBody,
        isInternal,
        markResolved,
      });
      setReplyBody("");
      setIsInternal(false);
      refetch();
    } catch (e: any) {
      alert(e.message || "Failed to send reply");
    }
  };

  const handleStatusChange = async (status: any) => {
    try {
      await statusMutation({ ticketId: ticket.id, status });
      refetch();
    } catch (e: any) {
      alert("Failed to update status");
    }
  };

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 300px", gap: 24, minHeight: "calc(100vh - 120px)" }}>
      {/* Main Conversation Area */}
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
          <div>
            <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 8 }}>
              <Link href="/support" style={{ color: "var(--admin-text-muted)", display: "flex", alignItems: "center" }}>
                <span className="material-symbols-outlined" style={{ fontSize: 18 }}>arrow_back</span>
              </Link>
              <p style={{ fontSize: 12, color: "var(--admin-text-muted)", margin: 0, fontFamily: "monospace" }}>{ticket.id}</p>
              <span className="admin-badge admin-badge--info">{ticket.category}</span>
            </div>
            <h2 style={{ fontSize: 24, fontWeight: 800, color: "var(--admin-text)", margin: 0 }}>{ticket.subject}</h2>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <span className={`admin-badge ${ticket.status === 'OPEN' ? 'admin-badge--cyan' : ticket.status === 'RESOLVED' ? 'admin-badge--success' : 'admin-badge--warning'}`}>
              {ticket.status}
            </span>
            <span className={`admin-badge ${ticket.priority === "URGENT" ? "admin-badge--error" : ticket.priority === "HIGH" ? "admin-badge--warning" : "admin-badge--muted"}`}>
              {ticket.priority}
            </span>
          </div>
        </div>

        {/* Thread */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16, flex: 1, overflowY: "auto", paddingRight: 8 }}>
          {ticket.messages.length === 0 ? (
            <div className="admin-card" style={{ textAlign: "center", padding: 40, color: "var(--admin-text-muted)" }}>
              No messages in this ticket thread yet.
            </div>
          ) : (
            ticket.messages.map((msg: any) => {
              const isAdmin = msg.senderType === "admin";
              return (
                <div key={msg.id} style={{ display: "flex", gap: 12, flexDirection: isAdmin ? "row-reverse" : "row" }}>
                  <div className="admin-sidebar-avatar" style={{ width: 36, height: 36, flexShrink: 0, background: isAdmin ? "var(--admin-primary)" : "var(--admin-surface-hover)" }}>
                    {isAdmin ? (msg.admin?.fullName?.charAt(0) || "A") : (user?.name?.charAt(0) || "U")}
                  </div>
                  <div style={{
                    maxWidth: "80%",
                    background: msg.isInternal ? "rgba(255, 171, 0, 0.1)" : isAdmin ? "rgba(0, 240, 255, 0.05)" : "var(--admin-surface)",
                    border: msg.isInternal ? "1px solid rgba(255, 171, 0, 0.3)" : `1px solid ${isAdmin ? "rgba(0, 240, 255, 0.2)" : "var(--admin-border)"}`,
                    padding: "16px 20px",
                    borderRadius: "12px",
                    borderTopLeftRadius: isAdmin ? "12px" : "4px",
                    borderTopRightRadius: isAdmin ? "4px" : "12px",
                  }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8, alignItems: "center" }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: isAdmin ? "var(--admin-primary)" : "var(--admin-text)" }}>
                        {msg.isInternal ? "Internal Note" : isAdmin ? msg.admin?.fullName || "Support Team" : user?.name || "Customer"}
                      </span>
                      <span style={{ fontSize: 11, color: "var(--admin-text-muted)" }}>
                        {new Date(msg.createdAt).toLocaleString()}
                      </span>
                    </div>
                    <div style={{ fontSize: 14, color: "var(--admin-text)", whiteSpace: "pre-wrap", lineHeight: 1.5 }}>
                      {msg.body}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Reply Composer */}
        <div className="admin-card" style={{ marginTop: "auto", border: "1px solid var(--admin-border)", padding: 16 }}>
          <div style={{ display: "flex", gap: 12, marginBottom: 12 }}>
            <button 
              className={`admin-btn admin-btn--sm ${!isInternal ? 'admin-btn--secondary' : 'admin-btn--ghost'}`}
              onClick={() => setIsInternal(false)}
            >
              Public Reply
            </button>
            <button 
              className={`admin-btn admin-btn--sm ${isInternal ? 'admin-btn--secondary' : 'admin-btn--ghost'}`}
              style={{ color: isInternal ? "var(--admin-warning)" : undefined }}
              onClick={() => setIsInternal(true)}
            >
              Internal Note (Hidden)
            </button>
          </div>
          <textarea
            className="admin-input"
            style={{ minHeight: 120, resize: "vertical", marginBottom: 16, background: isInternal ? "rgba(255, 171, 0, 0.05)" : "var(--admin-bg)" }}
            placeholder={isInternal ? "Add an internal note for other agents..." : "Type your reply to the customer..."}
            value={replyBody}
            onChange={e => setReplyBody(e.target.value)}
          />
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <button className="admin-btn admin-btn--ghost admin-btn--sm">
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>attach_file</span> Attach File
            </button>
            <div style={{ display: "flex", gap: 12 }}>
              <button 
                className="admin-btn admin-btn--primary" 
                disabled={isReplying || !replyBody.trim()} 
                onClick={() => handleReply(false)}
              >
                {isInternal ? "Add Note" : "Send Reply"}
              </button>
              {!isInternal && ticket.status !== 'RESOLVED' && (
                <button 
                  className="admin-btn admin-btn--secondary" 
                  disabled={isReplying || isStatusUpdating || !replyBody.trim()} 
                  onClick={() => handleReply(true)}
                >
                  Send & Resolve
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Right Sidebar — User Context */}
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div className="admin-card">
          <h3 className="admin-card-title" style={{ marginBottom: 16 }}>User Context</h3>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
            <div className="admin-sidebar-avatar" style={{ width: 40, height: 40 }}>
              {user?.name?.charAt(0) || "U"}
            </div>
            <div>
              <p style={{ margin: 0, fontWeight: 600, color: "var(--admin-text)" }}>{user?.name}</p>
              <p style={{ margin: 0, fontSize: 12, color: "var(--admin-text-muted)" }}>{user?.email}</p>
            </div>
          </div>
          <Link href={`/users/${user?.id}`} className="admin-btn admin-btn--secondary admin-btn--sm" style={{ width: "100%", justifyContent: "center", marginBottom: 20 }}>
            View Full Profile
          </Link>

          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ fontSize: 13, color: "var(--admin-text-muted)" }}>Plan</span>
              <span className={`admin-badge ${user?.plan === 'PRO' ? 'admin-badge--pro' : 'admin-badge--free'}`}>{user?.plan || "Free"}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ fontSize: 13, color: "var(--admin-text-muted)" }}>Workspaces</span>
              <span style={{ fontSize: 13, color: "var(--admin-text)" }}>{user?.workspaces?.length || 0} active</span>
            </div>
          </div>
        </div>

        <div className="admin-card">
          <h3 className="admin-card-title" style={{ marginBottom: 16 }}>Ticket Actions</h3>
          
          <p style={{ fontSize: 12, color: "var(--admin-text-muted)", marginBottom: 8 }}>Status Options</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 20 }}>
            {['OPEN', 'IN_PROGRESS', 'AWAITING_USER', 'RESOLVED', 'CLOSED'].map((s) => (
              <button 
                key={s}
                className={`admin-btn admin-btn--sm ${ticket.status === s ? 'admin-btn--secondary' : 'admin-btn--ghost'}`}
                style={{ justifyContent: "flex-start" }}
                onClick={() => handleStatusChange(s)}
                disabled={isStatusUpdating}
              >
                {ticket.status === s && <span className="material-symbols-outlined" style={{ fontSize: 14 }}>check</span>}
                Set to {s.replace('_', ' ')}
              </button>
            ))}
          </div>

          <p style={{ fontSize: 12, color: "var(--admin-text-muted)", marginBottom: 8 }}>Assignment</p>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 12px", background: "var(--admin-surface-hover)", borderRadius: 6 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              {ticket.assignee ? (
                <>
                  <div className="admin-sidebar-avatar" style={{ width: 20, height: 20, fontSize: 10 }}>{ticket.assignee.fullName?.charAt(0)}</div>
                  <span style={{ fontSize: 13, color: "var(--admin-text)" }}>{ticket.assignee.fullName}</span>
                </>
              ) : (
                <span style={{ fontSize: 13, color: "var(--admin-text-muted)" }}>Unassigned</span>
              )}
            </div>
            <button className="admin-btn admin-btn--ghost admin-btn--sm" style={{ padding: "4px 8px" }}>Change</button>
          </div>
        </div>
      </div>
    </div>
  );
}
import Link from 'next/link';
