"use client";

import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { formatNumber } from "@/lib/utils";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";

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
      Placeholder.configure({ placeholder: "Start composing your broadcast message... Use rich formatting to make it stand out." }),
    ],
    content: value,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
    editorProps: {
      attributes: {
        class: "prose prose-sm focus:outline-none min-h-[200px] p-4",
        style: "min-height: 200px; padding: 16px; font-size: 14px; line-height: 1.6; color: var(--admin-text); outline: none;",
      }
    }
  });

  // Sync when value is cleared externally
  useEffect(() => {
    if (editor && value === "" && editor.getHTML() !== "<p></p>") {
      editor.commands.setContent("");
    }
  }, [value, editor]);

  if (!editor) return null;

  const ToolbarBtn = ({ icon, isActive, onClick }: { icon: string; isActive: boolean; onClick: () => void }) => (
    <button
      type="button"
      onClick={onClick}
      style={{
        width: 28, height: 28,
        display: "flex", alignItems: "center", justifyContent: "center",
        borderRadius: 4,
        background: isActive ? "var(--admin-border)" : "transparent",
        border: "none", cursor: "pointer",
      }}
    >
      <span className="material-symbols-outlined" style={{ fontSize: 16, color: isActive ? "var(--admin-text)" : "var(--admin-text-muted)" }}>
        {icon}
      </span>
    </button>
  );

  return (
    <div style={{ border: "1px solid var(--admin-border)", borderRadius: "0 0 8px 8px", overflow: "hidden" }}>
      {/* Toolbar */}
      <div style={{
        display: "flex", gap: 4, padding: "8px 12px",
        background: "var(--admin-bg)",
        borderBottom: "1px solid var(--admin-border)",
      }}>
        <ToolbarBtn icon="format_bold" isActive={editor.isActive("bold")} onClick={() => editor.chain().focus().toggleBold().run()} />
        <ToolbarBtn icon="format_italic" isActive={editor.isActive("italic")} onClick={() => editor.chain().focus().toggleItalic().run()} />
        <ToolbarBtn icon="format_strikethrough" isActive={editor.isActive("strike")} onClick={() => editor.chain().focus().toggleStrike().run()} />
        <div style={{ width: 1, background: "var(--admin-border)", margin: "0 4px" }} />
        <ToolbarBtn icon="format_list_bulleted" isActive={editor.isActive("bulletList")} onClick={() => editor.chain().focus().toggleBulletList().run()} />
        <ToolbarBtn icon="format_list_numbered" isActive={editor.isActive("orderedList")} onClick={() => editor.chain().focus().toggleOrderedList().run()} />
        <div style={{ width: 1, background: "var(--admin-border)", margin: "0 4px" }} />
        <ToolbarBtn icon="format_quote" isActive={editor.isActive("blockquote")} onClick={() => editor.chain().focus().toggleBlockquote().run()} />
        <ToolbarBtn icon="horizontal_rule" isActive={false} onClick={() => editor.chain().focus().setHorizontalRule().run()} />
      </div>
      {/* Editor */}
      <div style={{ background: "var(--admin-surface)", minHeight: 200 }}>
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}

// ─── Main Compose Page ──────────────────────────────────

export default function BroadcastComposePage() {
  const router = useRouter();
  const [activeSegment, setActiveSegment] = useState("ALL");
  const [activeChannel, setActiveChannel] = useState("EMAIL");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [isScheduled, setIsScheduled] = useState(false);
  const [scheduleDate, setScheduleDate] = useState("");
  const [selectedTaxYears, setSelectedTaxYears] = useState<number[]>([]);

  // Fetch available tax years
  const { data: taxYearsData } = trpc.admin.broadcast.getAvailableTaxYears.useQuery();

  // Segment estimate with tax year filter
  const { data: estimateData, isLoading: isEstimating } = trpc.admin.broadcast.getSegmentEstimate.useQuery({
    segmentType: activeSegment as any,
    taxYears: selectedTaxYears.length > 0 ? selectedTaxYears : undefined,
  });

  const { mutateAsync: createBroadcast, isPending } = trpc.admin.broadcast.createBroadcast.useMutation();

  const toggleTaxYear = (year: number) => {
    setSelectedTaxYears(prev =>
      prev.includes(year) ? prev.filter(y => y !== year) : [...prev, year]
    );
  };

  const handleSend = async (saveAsDraft = false) => {
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
        taxYears: selectedTaxYears.length > 0 ? selectedTaxYears : undefined,
        saveAsDraft,
        scheduledAt: isScheduled && scheduleDate ? new Date(scheduleDate) : undefined,
      });
      router.push("/broadcast");
    } catch (e: any) {
      alert(e.message || "Failed to create broadcast. Check console.");
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Back Button */}
      <Link href="/broadcast" className="admin-btn admin-btn--ghost admin-btn--sm" style={{ alignSelf: "flex-start" }}>
        <span className="material-symbols-outlined" style={{ fontSize: 18 }}>arrow_back</span>
        Back to Broadcasts
      </Link>

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
          <BroadcastEditor value={body} onChange={setBody} />
        </div>

      </div>

      {/* Right Sidebar — Preview + Schedule + Tax Year */}
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div className="admin-card">
          <p className="admin-kpi-label">Segment Preview</p>
          <p style={{ fontSize: 32, fontWeight: 800, color: "var(--admin-text)", margin: "8px 0 4px" }}>
            {isEstimating ? "..." : formatNumber(estimateData?.count || 0)}
          </p>
          <p style={{ fontSize: 12, color: "var(--admin-text-muted)", margin: 0 }}>Total Reach</p>
        </div>

        {/* Tax Year Filter */}
        {taxYearsData && taxYearsData.length > 0 && (
          <div className="admin-card">
            <p className="admin-kpi-label" style={{ marginBottom: 12 }}>Filter by Tax Year</p>
            <p style={{ fontSize: 12, color: "var(--admin-text-muted)", margin: "0 0 12px" }}>
              Select tax years to narrow your audience. Leave empty for all.
            </p>
            {taxYearsData.map((year: number) => (
              <label key={year} style={{
                display: "flex", alignItems: "center", gap: 8,
                marginBottom: 8, cursor: "pointer",
                fontSize: 13, color: "var(--admin-text)",
              }}>
                <input
                  type="checkbox"
                  checked={selectedTaxYears.includes(year)}
                  onChange={() => toggleTaxYear(year)}
                  style={{ accentColor: "var(--admin-primary)" }}
                />
                {year} Tax Year
              </label>
            ))}
          </div>
        )}

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
              min={new Date().toISOString().slice(0, 16)}
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
          onClick={() => handleSend(false)}
          disabled={isPending || (!subject || !body)}
        >
          {isPending ? "Processing..." : (isScheduled ? "Schedule Broadcast" : "Send Now")}
          <span className="material-symbols-outlined" style={{ fontSize: 18 }}>send</span>
        </button>

        <button 
          className="admin-btn admin-btn--ghost" 
          style={{ width: "100%", justifyContent: "center", padding: 12 }}
          onClick={() => handleSend(true)}
          disabled={isPending || !subject}
        >
          <span className="material-symbols-outlined" style={{ fontSize: 18 }}>save</span>
          Save as Draft
        </button>
      </div>
    </div>
    </div>
  );
}
