"use client";

import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { useRouter, useParams } from "next/navigation";
import { formatNumber } from "@/lib/utils";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import Link from "next/link";

const SEGMENTS = [
  { id: "ALL", label: "All Users", icon: "people" },
  { id: "SUBSCRIBERS", label: "Paid Users", icon: "workspace_premium" },
  { id: "FREE", label: "Free Tier Only", icon: "person" },
];

const CHANNELS = [
  { id: "EMAIL", label: "Email", icon: "email" },
  { id: "IN_APP", label: "In-App Push", icon: "notifications" },
  { id: "BOTH", label: "Both Channels", icon: "campaign" },
];

// ─── Rich Text Editor ───────────────────────────────────

function BroadcastEditor({ value, onChange }: { value: string; onChange: (html: string) => void }) {
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit,
      Placeholder.configure({ placeholder: "Compose your broadcast message with rich formatting..." }),
    ],
    content: value,
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
    editorProps: {
      attributes: {
        class: "prose prose-sm focus:outline-none min-h-[200px] p-4",
        style: "min-height: 200px; padding: 16px; font-size: 14px; line-height: 1.6; color: var(--admin-text); outline: none;",
      }
    }
  });

  // Update editor content when data loads
  useEffect(() => {
    if (editor && value && editor.isEmpty) {
      editor.commands.setContent(value);
    }
  }, [value, editor]);

  if (!editor) return null;

  const ToolbarBtn = ({ icon, isActive, onClick }: { icon: string; isActive: boolean; onClick: () => void }) => (
    <button type="button" onClick={onClick} style={{
      width: 28, height: 28, display: "flex", alignItems: "center", justifyContent: "center",
      borderRadius: 4, background: isActive ? "var(--admin-border)" : "transparent", border: "none", cursor: "pointer",
    }}>
      <span className="material-symbols-outlined" style={{ fontSize: 16, color: isActive ? "var(--admin-text)" : "var(--admin-text-muted)" }}>{icon}</span>
    </button>
  );

  return (
    <div style={{ border: "1px solid var(--admin-border)", borderRadius: "0 0 8px 8px", overflow: "hidden" }}>
      <div style={{ display: "flex", gap: 4, padding: "8px 12px", background: "var(--admin-bg)", borderBottom: "1px solid var(--admin-border)" }}>
        <ToolbarBtn icon="format_bold" isActive={editor.isActive("bold")} onClick={() => editor.chain().focus().toggleBold().run()} />
        <ToolbarBtn icon="format_italic" isActive={editor.isActive("italic")} onClick={() => editor.chain().focus().toggleItalic().run()} />
        <div style={{ width: 1, background: "var(--admin-border)", margin: "0 4px" }} />
        <ToolbarBtn icon="format_list_bulleted" isActive={editor.isActive("bulletList")} onClick={() => editor.chain().focus().toggleBulletList().run()} />
        <ToolbarBtn icon="format_list_numbered" isActive={editor.isActive("orderedList")} onClick={() => editor.chain().focus().toggleOrderedList().run()} />
        <div style={{ width: 1, background: "var(--admin-border)", margin: "0 4px" }} />
        <ToolbarBtn icon="format_quote" isActive={editor.isActive("blockquote")} onClick={() => editor.chain().focus().toggleBlockquote().run()} />
      </div>
      <div style={{ background: "var(--admin-surface)", minHeight: 200 }}>
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}

// ─── Edit Broadcast Page ────────────────────────────────

export default function BroadcastEditPage() {
  const params = useParams();
  const broadcastId = params.id as string;
  const router = useRouter();

  const { data, isLoading } = trpc.admin.broadcast.getBroadcast.useQuery({ id: broadcastId });
  const broadcast = data as any;
  const { data: taxYearsData } = trpc.admin.broadcast.getAvailableTaxYears.useQuery();

  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [activeSegment, setActiveSegment] = useState("ALL");
  const [activeChannel, setActiveChannel] = useState("EMAIL");
  const [selectedTaxYears, setSelectedTaxYears] = useState<number[]>([]);
  const [isScheduled, setIsScheduled] = useState(false);
  const [scheduleDate, setScheduleDate] = useState("");
  const [loaded, setLoaded] = useState(false);

  // Populate form when broadcast data loads
  useEffect(() => {
    if (broadcast && !loaded) {
      setSubject(broadcast.subject);
      setBody(broadcast.body);
      setActiveSegment(broadcast.segmentType);
      setActiveChannel(broadcast.channel);
      const cfg = broadcast.segmentConfig as any;
      setSelectedTaxYears(cfg?.taxYears || []);
      if (broadcast.scheduledAt) {
        setIsScheduled(true);
        setScheduleDate(new Date(broadcast.scheduledAt).toISOString().slice(0, 16));
      }
      setLoaded(true);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [broadcast, loaded] as any);

  const { data: estimateData, isLoading: isEstimating } = trpc.admin.broadcast.getSegmentEstimate.useQuery({
    segmentType: activeSegment,
    taxYears: selectedTaxYears.length > 0 ? selectedTaxYears : undefined,
  } as any);

  const { mutateAsync: updateBroadcast, isPending } = trpc.admin.broadcast.updateBroadcast.useMutation();

  const toggleTaxYear = (year: number) => {
    setSelectedTaxYears(prev => prev.includes(year) ? prev.filter(y => y !== year) : [...prev, year]);
  };

  const isDraftOrScheduled = broadcast?.status === 'DRAFT' || broadcast?.status === 'SCHEDULED';

  const handleUpdate = async (sendNow = false) => {
    try {
      await updateBroadcast({
        id: broadcastId,
        subject,
        body,
        channel: activeChannel as any,
        segmentType: activeSegment as any,
        taxYears: selectedTaxYears.length > 0 ? selectedTaxYears : undefined,
        sendNow,
        scheduledAt: !sendNow && isScheduled && scheduleDate ? new Date(scheduleDate) : undefined,
      });
      router.push("/broadcast");
    } catch (e: any) {
      alert(e.message || "Failed to update broadcast.");
    }
  };

  if (isLoading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: 400, color: "var(--admin-text-muted)" }}>
        Loading broadcast...
      </div>
    );
  }

  if (!broadcast) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16, minHeight: 400, justifyContent: "center" }}>
        <span className="material-symbols-outlined" style={{ fontSize: 48, opacity: 0.3 }}>error</span>
        <p style={{ color: "var(--admin-text-muted)" }}>Broadcast not found</p>
        <Link href="/broadcast" className="admin-btn admin-btn--ghost">← Back to Broadcasts</Link>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Header with back button */}
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <Link href="/broadcast" className="admin-btn admin-btn--ghost admin-btn--sm">
          <span className="material-symbols-outlined" style={{ fontSize: 18 }}>arrow_back</span>
          Back
        </Link>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: "var(--admin-text)", margin: 0 }}>
            {isDraftOrScheduled ? "Edit Broadcast" : "View Broadcast"}
          </h2>
          <p style={{ fontSize: 13, color: "var(--admin-text-muted)", margin: "4px 0 0" }}>
            Status: <span className={`admin-badge admin-badge--${broadcast.status === 'SENT' ? 'success' : broadcast.status === 'DRAFT' ? 'muted' : 'warning'}`}>{broadcast.status}</span>
          </p>
        </div>
      </div>

      {/* Main content grid */}
      <div style={{ display: "grid", gridTemplateColumns: "220px 1fr 280px", gap: 20 }}>
        {/* Left Sidebar — Targeting */}
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div>
            <p className="admin-kpi-label" style={{ marginBottom: 8 }}>Targeting Options</p>
            {SEGMENTS.map((seg) => (
              <button key={seg.id} onClick={() => isDraftOrScheduled && setActiveSegment(seg.id)}
                className={`admin-sidebar-link ${activeSegment === seg.id ? "admin-sidebar-link--active" : ""}`}
                style={{ width: "100%", opacity: isDraftOrScheduled ? 1 : 0.6 }} disabled={!isDraftOrScheduled}>
                <span className="material-symbols-outlined" style={{ fontSize: 18 }}>{seg.icon}</span>
                {seg.label}
              </button>
            ))}
          </div>
          <div>
            <p className="admin-kpi-label" style={{ marginBottom: 8 }}>Message Channel</p>
            {CHANNELS.map((ch) => (
              <button key={ch.id} onClick={() => isDraftOrScheduled && setActiveChannel(ch.id)}
                className={`admin-sidebar-link ${activeChannel === ch.id ? "admin-sidebar-link--active" : ""}`}
                style={{ width: "100%", opacity: isDraftOrScheduled ? 1 : 0.6 }} disabled={!isDraftOrScheduled}>
                <span className="material-symbols-outlined" style={{ fontSize: 18 }}>{ch.icon}</span>
                {ch.label}
              </button>
            ))}
          </div>
        </div>

        {/* Centre — Editor */}
        <div className="admin-card" style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ marginBottom: 16 }}>
            <label className="admin-label">Subject Line</label>
            <input type="text" className="admin-input" placeholder="Enter message subject..." value={subject}
              onChange={(e) => setSubject(e.target.value)} disabled={!isDraftOrScheduled} />
          </div>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            <label className="admin-label">Message Content</label>
            {isDraftOrScheduled ? (
              <BroadcastEditor value={body} onChange={setBody} />
            ) : (
              <div className="admin-card" style={{ flex: 1, minHeight: 200 }}>
                <div className="prose prose-sm" dangerouslySetInnerHTML={{ __html: body }} />
              </div>
            )}
          </div>
        </div>

        {/* Right Sidebar */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div className="admin-card">
            <p className="admin-kpi-label">Segment Preview</p>
            <p style={{ fontSize: 32, fontWeight: 800, color: "var(--admin-text)", margin: "8px 0 4px" }}>
              {isDraftOrScheduled ? (isEstimating ? "..." : formatNumber(estimateData?.count || 0)) : formatNumber(broadcast.totalRecipients)}
            </p>
            <p style={{ fontSize: 12, color: "var(--admin-text-muted)", margin: 0 }}>
              {isDraftOrScheduled ? "Total Reach" : `Delivered: ${broadcast.delivered} / Failed: ${broadcast.failed}`}
            </p>
          </div>

          {/* Tax Year Filter */}
          {isDraftOrScheduled && taxYearsData && taxYearsData.length > 0 && (
            <div className="admin-card">
              <p className="admin-kpi-label" style={{ marginBottom: 12 }}>Filter by Tax Year</p>
              {taxYearsData.map((year: number) => (
                <label key={year} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, cursor: "pointer", fontSize: 13, color: "var(--admin-text)" }}>
                  <input type="checkbox" checked={selectedTaxYears.includes(year)} onChange={() => toggleTaxYear(year)} style={{ accentColor: "var(--admin-primary)" }} />
                  {year} Tax Year
                </label>
              ))}
            </div>
          )}

          {isDraftOrScheduled && (
            <>
              <div className="admin-card">
                <p className="admin-kpi-label" style={{ marginBottom: 12 }}>Schedule Delivery</p>
                <label style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, cursor: "pointer", fontSize: 13, color: "var(--admin-text)" }}>
                  <input type="radio" name="schedule" checked={!isScheduled} onChange={() => setIsScheduled(false)} /> Send Now
                </label>
                <label style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: isScheduled ? 8 : 0, cursor: "pointer", fontSize: 13, color: "var(--admin-text)" }}>
                  <input type="radio" name="schedule" checked={isScheduled} onChange={() => setIsScheduled(true)} /> Schedule Later
                </label>
                {isScheduled && (
                  <input type="datetime-local" className="admin-input" value={scheduleDate}
                    onChange={(e) => setScheduleDate(e.target.value)} min={new Date().toISOString().slice(0, 16)} />
                )}
              </div>

              <button className="admin-btn admin-btn--primary" style={{ width: "100%", justifyContent: "center", padding: 12 }}
                onClick={() => handleUpdate(isScheduled ? false : true)} disabled={isPending || !subject || !body}>
                {isPending ? "Processing..." : (isScheduled ? "Update Schedule" : "Send Now")}
                <span className="material-symbols-outlined" style={{ fontSize: 18 }}>send</span>
              </button>

              <button className="admin-btn admin-btn--ghost" style={{ width: "100%", justifyContent: "center", padding: 12 }}
                onClick={() => handleUpdate(false)} disabled={isPending || !subject}>
                <span className="material-symbols-outlined" style={{ fontSize: 18 }}>save</span>
                Save Changes
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
