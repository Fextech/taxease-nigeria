"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useRouter } from "next/navigation";
import { formatNumber } from "@/lib/utils";

const SEGMENTS = [
  { id: "ALL", label: "All Users", icon: "people" },
  { id: "SUBSCRIBERS", label: "Subscribers Only", icon: "star" },
  { id: "FREE", label: "Free Tier Only", icon: "person" },
];

const CHANNELS = [
  { id: "EMAIL", label: "Email", icon: "email" },
  { id: "IN_APP", label: "In-App Push", icon: "notifications" },
  { id: "BOTH", label: "Both Channels", icon: "campaign" },
];

export default function BroadcastComposePage() {
  const router = useRouter();
  const [activeSegment, setActiveSegment] = useState("ALL");
  const [activeChannel, setActiveChannel] = useState("EMAIL");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [isScheduled, setIsScheduled] = useState(false);
  const [scheduleDate, setScheduleDate] = useState("");

  const { data: estimateData, isLoading: isEstimating } = trpc.admin.broadcast.getSegmentEstimate.useQuery({
    segmentType: activeSegment as any
  });

  const { mutateAsync: createBroadcast, isPending } = trpc.admin.broadcast.createBroadcast.useMutation();

  const handleSend = async () => {
    if (!subject || !body) {
      alert("Subject and Body are required.");
      return;
    }
    
    try {
      await createBroadcast({
        subject,
        body,
        channel: activeChannel as any,
        segmentType: activeSegment as any,
        saveAsDraft: false,
        scheduledAt: isScheduled && scheduleDate ? new Date(scheduleDate) : undefined,
      });
      router.push("/broadcast");
    } catch (e: any) {
      alert(e.message || "Failed to create broadcast. Check console.");
    }
  };

  return (
    <div style={{ display: "grid", gridTemplateColumns: "220px 1fr 280px", gap: 20, minHeight: "calc(100vh - 120px)" }}>
      {/* Left Sidebar — Targeting */}
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        <div>
          <p className="admin-kpi-label" style={{ marginBottom: 8 }}>Targeting Options</p>
          {SEGMENTS.map((seg) => (
            <button
              key={seg.id}
              onClick={() => setActiveSegment(seg.id)}
              className={`admin-sidebar-link ${activeSegment === seg.id ? "admin-sidebar-link--active" : ""}`}
              style={{ width: "100%" }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 18 }}>{seg.icon}</span>
              {seg.label}
            </button>
          ))}
        </div>
        <div>
          <p className="admin-kpi-label" style={{ marginBottom: 8 }}>Message Channel</p>
          {CHANNELS.map((ch) => (
            <button
              key={ch.id}
              onClick={() => setActiveChannel(ch.id)}
              className={`admin-sidebar-link ${activeChannel === ch.id ? "admin-sidebar-link--active" : ""}`}
              style={{ width: "100%" }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 18 }}>{ch.icon}</span>
              {ch.label}
            </button>
          ))}
        </div>
      </div>

      {/* Centre — Composer */}
      <div className="admin-card" style={{ display: 'flex', flexDirection: 'column' }}>
        <h2 style={{ fontSize: 22, fontWeight: 800, color: "var(--admin-text)", margin: "0 0 4px" }}>Create New Broadcast</h2>
        <p style={{ fontSize: 13, color: "var(--admin-text-muted)", margin: "0 0 24px" }}>Compose and personalize your message for the selected audience.</p>

        <div style={{ marginBottom: 16 }}>
          <label className="admin-label">Subject Line</label>
          <div style={{ display: "flex", gap: 8 }}>
            <input
              type="text"
              className="admin-input"
              placeholder="Enter message subject..."
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
            />
          </div>
        </div>

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <label className="admin-label">Message Content</label>
          {/* Toolbar */}
          <div style={{
            display: "flex",
            gap: 4,
            padding: "8px 12px",
            background: "var(--admin-bg)",
            borderRadius: "var(--admin-radius) var(--admin-radius) 0 0",
            border: "1px solid var(--admin-border)",
            borderBottom: "none",
          }}>
            {["format_bold", "format_italic", "format_list_bulleted", "link", "image"].map((icon) => (
              <button key={icon} className="admin-header-icon-btn">
                <span className="material-symbols-outlined" style={{ fontSize: 18 }}>{icon}</span>
              </button>
            ))}
            <button className="admin-btn admin-btn--primary admin-btn--sm" style={{ marginLeft: "auto" }} onClick={() => setBody(prev => prev + ' {{first_name}} ')}>
              <span className="material-symbols-outlined" style={{ fontSize: 14 }}>token</span>
              Insert Token
            </button>
          </div>
          <textarea
            className="admin-input"
            style={{
              flex: 1,
              minHeight: 200,
              borderRadius: "0 0 var(--admin-radius) var(--admin-radius)",
              resize: "vertical",
              fontFamily: 'monospace'
            }}
            placeholder="Start typing your HTML or plain text message here... Use {{first_name}} to address users personally."
            value={body}
            onChange={(e) => setBody(e.target.value)}
          />
        </div>

      </div>

      {/* Right Sidebar — Preview + Schedule */}
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div className="admin-card">
          <p className="admin-kpi-label">Segment Preview</p>
          <p style={{ fontSize: 32, fontWeight: 800, color: "var(--admin-text)", margin: "8px 0 4px" }}>
            {isEstimating ? "..." : formatNumber(estimateData?.count || 0)}
          </p>
          <p style={{ fontSize: 12, color: "var(--admin-text-muted)", margin: 0 }}>Total Reach</p>
        </div>

        <div className="admin-card">
          <p className="admin-kpi-label" style={{ marginBottom: 12 }}>Schedule Delivery</p>
          <label style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, cursor: "pointer", fontSize: 13, color: "var(--admin-text)" }}>
            <input type="radio" name="schedule" checked={!isScheduled} onChange={() => setIsScheduled(false)} /> Send Now
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: isScheduled ? 8 : 0, cursor: "pointer", fontSize: 13, color: "var(--admin-text)" }}>
            <input type="radio" name="schedule" checked={isScheduled} onChange={() => setIsScheduled(true)} /> Schedule Later
          </label>
          {isScheduled && (
            <input 
              type="datetime-local" 
              className="admin-input" 
              value={scheduleDate}
              onChange={(e) => setScheduleDate(e.target.value)}
            />
          )}
        </div>

        <div className="admin-card" style={{ background: "var(--admin-surface-hover)" }}>
          <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
            <span className="material-symbols-outlined" style={{ fontSize: 18, color: "var(--admin-warning)" }}>info</span>
            <p style={{ fontSize: 12, color: "var(--admin-text-muted)", margin: 0 }}>
              Broadcasts can&apos;t be edited once they are scheduled or sent. Double check your segment preview properly.
            </p>
          </div>
        </div>

        <button 
          className="admin-btn admin-btn--primary" 
          style={{ width: "100%", justifyContent: "center", padding: 12 }}
          onClick={handleSend}
          disabled={isPending || (!subject || !body)}
        >
          {isPending ? "Processing..." : (isScheduled ? "Schedule Broadcast" : "Send Now")}
          <span className="material-symbols-outlined" style={{ fontSize: 18 }}>send</span>
        </button>
      </div>
    </div>
  );
}
