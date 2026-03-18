"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

const REPORT_TYPES = [
    { id: 'USER_GROWTH', label: 'User Growth & Retention', icon: 'trending_up' },
    { id: 'SUBSCRIPTION_MRR', label: 'Subscription & MRR', icon: 'payments' },
    { id: 'PROCESSING_VOLUME', label: 'Statement Processing Volume', icon: 'receipt_long' },
    { id: 'TAX_YEAR_ACTIVITY', label: 'Tax Year Activity', icon: 'calendar_month' },
    { id: 'SUPPORT_PERFORMANCE', label: 'Support SLA & Performance', icon: 'support_agent' },
    { id: 'BROADCAST_ENGAGEMENT', label: 'Broadcast Engagement', icon: 'campaign' },
    { id: 'PLATFORM_HEALTH', label: 'Platform & API Health', icon: 'monitor_heart' }
] as const;

export default function AnalyticsPage() {
    const [selectedReport, setSelectedReport] = useState<typeof REPORT_TYPES[number]['id']>('USER_GROWTH');
    
    // Default to last 30 days
    const defaultEnd = new Date();
    const defaultStart = new Date();
    defaultStart.setDate(defaultStart.getDate() - 30);
    
    const [dateRange, setDateRange] = useState({
        start: defaultStart.toISOString().slice(0, 10),
        end: defaultEnd.toISOString().slice(0, 10),
    });

    const [isScheduling, setIsScheduling] = useState(false);
    const [scheduleEmails, setScheduleEmails] = useState("");
    const [scheduleFreq, setScheduleFreq] = useState<"DAILY" | "WEEKLY" | "MONTHLY">("WEEKLY");

    const utils = trpc.useUtils();

    const { data: reportData, isLoading } = trpc.admin.analytics.getReportData.useQuery({
        reportType: selectedReport,
        startDate: dateRange.start,
        endDate: dateRange.end,
    });

    const exportMutation = trpc.admin.analytics.exportReport.useMutation();
    const scheduleMutation = trpc.admin.analytics.scheduleReport.useMutation();

    const handleExport = async (format: 'csv' | 'pdf' | 'excel') => {
        try {
            const res = await exportMutation.mutateAsync({
                reportType: selectedReport,
                format,
                startDate: dateRange.start,
                endDate: dateRange.end,
            });
            const a = document.createElement("a");
            a.href = res.dataUrl;
            a.download = res.filename;
            a.click();
        } catch (e) {
            alert("Export failed");
        }
    };

    const handleSchedule = async () => {
        if (!scheduleEmails) return alert("Please enter at least one email");
        try {
            await scheduleMutation.mutateAsync({
                reportType: selectedReport,
                frequency: scheduleFreq,
                recipients: scheduleEmails.split(',').map(e => e.trim()),
            });
            alert("Report scheduled successfully!");
            setIsScheduling(false);
            setScheduleEmails("");
        } catch (e) {
            alert("Scheduling failed: Invalid email format?");
        }
    };

    const activeReportObj = REPORT_TYPES.find(r => r.id === selectedReport);

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
            {/* Header */}
            <div>
                <h1 style={{ fontSize: 24, fontWeight: 800, color: "var(--admin-text)", margin: "0 0 8px" }}>Analytics & Reports</h1>
                <p style={{ color: "var(--admin-text-muted)", margin: 0, fontSize: 14 }}>
                    Generate, visualize, and distribute system-wide reports and metrics.
                </p>
            </div>

            <div style={{ display: "flex", gap: 24, alignItems: "flex-start" }}>
                {/* Catalog Sidebar */}
                <div style={{ width: 280, display: "flex", flexDirection: "column", gap: 8 }}>
                    <h3 style={{ fontSize: 13, textTransform: "uppercase", letterSpacing: "1px", color: "var(--admin-text-muted)", margin: "0 0 8px" }}>Report Catalog</h3>
                    {REPORT_TYPES.map(report => (
                        <button
                            key={report.id}
                            onClick={() => setSelectedReport(report.id)}
                            style={{
                                display: "flex", alignItems: "center", gap: 12, padding: "12px 16px",
                                border: "1px solid", borderRadius: 8, cursor: "pointer",
                                borderColor: selectedReport === report.id ? "var(--admin-cyan)" : "transparent",
                                background: selectedReport === report.id ? "rgba(0, 240, 255, 0.05)" : "rgba(255,255,255,0.02)",
                                color: selectedReport === report.id ? "var(--admin-cyan)" : "var(--admin-text-muted)",
                                textAlign: "left", transition: "all 0.2s"
                            }}
                        >
                            <span className="material-symbols-outlined" style={{ fontSize: 20 }}>{report.icon}</span>
                            <span style={{ fontSize: 13, fontWeight: selectedReport === report.id ? 600 : 400 }}>{report.label}</span>
                        </button>
                    ))}
                </div>

                {/* Report Viewer Content */}
                <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 24 }}>
                    
                    {/* Toolbar */}
                    <div className="admin-card" style={{ padding: "16px 24px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16 }}>
                        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                            <span className="material-symbols-outlined" style={{ color: "var(--admin-text-muted)" }}>date_range</span>
                            <input 
                                type="date" 
                                className="admin-input" 
                                value={dateRange.start} 
                                onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })} 
                            />
                            <span style={{ color: "var(--admin-text-muted)" }}>to</span>
                            <input 
                                type="date" 
                                className="admin-input" 
                                value={dateRange.end} 
                                onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })} 
                            />
                        </div>

                        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                            <button onClick={() => setIsScheduling(!isScheduling)} className="admin-btn admin-btn--secondary">
                                <span className="material-symbols-outlined" style={{ fontSize: 18 }}>schedule</span> Schedule
                            </button>
                            <div style={{ position: "relative" }}>
                                <select 
                                    className="admin-btn admin-btn--primary" 
                                    onChange={(e) => {
                                        if (e.target.value) handleExport(e.target.value as any);
                                        e.target.value = "";
                                    }}
                                    style={{ cursor: "pointer", appearance: "none", paddingRight: 32 }}
                                    disabled={exportMutation.isPending}
                                >
                                    <option value="" disabled selected>{exportMutation.isPending ? "Exporting..." : "Export Report"}</option>
                                    <option value="csv">Download as CSV</option>
                                    <option value="excel">Download as Excel</option>
                                    <option value="pdf">Download as PDF</option>
                                </select>
                                <span className="material-symbols-outlined" style={{ position: "absolute", right: 10, top: 10, pointerEvents: "none" }}>download</span>
                            </div>
                        </div>
                    </div>

                    {isScheduling && (
                        <div className="admin-card" style={{ padding: 24, background: "rgba(0, 240, 255, 0.05)", border: "1px solid rgba(0, 240, 255, 0.2)" }}>
                            <h3 style={{ margin: "0 0 16px", color: "var(--admin-cyan)" }}>Schedule this Report</h3>
                            <div style={{ display: "flex", gap: 16, alignItems: "flex-end" }}>
                                <div style={{ flex: 1 }}>
                                    <label style={{ display: "block", fontSize: 12, marginBottom: 8, color: "var(--admin-text-muted)" }}>Recipient Emails (comma separated)</label>
                                    <input type="text" className="admin-input" placeholder="admin@taxease.ng, ceo@taxease.ng" value={scheduleEmails} onChange={e => setScheduleEmails(e.target.value)} />
                                </div>
                                <div style={{ width: 150 }}>
                                    <label style={{ display: "block", fontSize: 12, marginBottom: 8, color: "var(--admin-text-muted)" }}>Frequency</label>
                                    <select className="admin-input" value={scheduleFreq} onChange={e => setScheduleFreq(e.target.value as any)}>
                                        <option value="DAILY">Daily</option>
                                        <option value="WEEKLY">Weekly</option>
                                        <option value="MONTHLY">Monthly</option>
                                    </select>
                                </div>
                                <button className="admin-btn admin-btn--primary" onClick={handleSchedule} disabled={scheduleMutation.isPending}>
                                    Save Schedule
                                </button>
                                <button className="admin-btn admin-btn--ghost" onClick={() => setIsScheduling(false)}>Cancel</button>
                            </div>
                        </div>
                    )}

                    {/* Report Data Viewer */}
                    <div className="admin-card" style={{ padding: 24, minHeight: 400 }}>
                        <h2 style={{ fontSize: 20, color: "var(--admin-text)", margin: "0 0 24px", display: "flex", alignItems: "center", gap: 12 }}>
                            <span className="material-symbols-outlined" style={{ color: "var(--admin-cyan)" }}>{activeReportObj?.icon}</span>
                            {activeReportObj?.label} Overview
                        </h2>

                        {isLoading ? (
                            <div style={{ textAlign: "center", padding: 60, color: "var(--admin-text-muted)" }}>Generating report...</div>
                        ) : reportData ? (
                            <div style={{ display: "flex", flexDirection: "column", gap: 32 }}>
                                
                                {/* Summary KPIs */}
                                <div style={{ display: "flex", gap: 24 }}>
                                    <div style={{ flex: 1, padding: 20, background: "rgba(255,255,255,0.02)", borderRadius: 8 }}>
                                        <span style={{ color: "var(--admin-text-muted)", fontSize: 13 }}>Total Over Period</span>
                                        <div style={{ fontSize: 32, fontWeight: 700, color: "var(--admin-text)", marginTop: 8 }}>
                                            {reportData.summary.total.toLocaleString()}
                                        </div>
                                    </div>
                                    <div style={{ flex: 1, padding: 20, background: "rgba(255,255,255,0.02)", borderRadius: 8 }}>
                                        <span style={{ color: "var(--admin-text-muted)", fontSize: 13 }}>Daily Average</span>
                                        <div style={{ fontSize: 32, fontWeight: 700, color: "var(--admin-text)", marginTop: 8 }}>
                                            {reportData.summary.average.toLocaleString()}
                                        </div>
                                    </div>
                                    <div style={{ flex: 1, padding: 20, background: "rgba(255,255,255,0.02)", borderRadius: 8 }}>
                                        <span style={{ color: "var(--admin-text-muted)", fontSize: 13 }}>Period Trend</span>
                                        <div style={{ fontSize: 32, fontWeight: 700, color: "var(--admin-success)", marginTop: 8 }}>
                                            {reportData.summary.trend} <span className="material-symbols-outlined" style={{ fontSize: 24 }}>arrow_upward</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Chart */}
                                <div style={{ height: 350, width: "100%" }}>
                                    <ResponsiveContainer width="100%" height="100%">
                                        <AreaChart data={reportData.points} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
                                            <defs>
                                                <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="5%" stopColor="var(--admin-cyan)" stopOpacity={0.3}/>
                                                    <stop offset="95%" stopColor="var(--admin-cyan)" stopOpacity={0}/>
                                                </linearGradient>
                                                <linearGradient id="colorSec" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="5%" stopColor="#fff" stopOpacity={0.1}/>
                                                    <stop offset="95%" stopColor="#fff" stopOpacity={0}/>
                                                </linearGradient>
                                            </defs>
                                            <XAxis 
                                                dataKey="date" 
                                                stroke="var(--admin-text-muted)" 
                                                fontSize={12} 
                                                tickFormatter={(v) => new Date(v).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                                            />
                                            <YAxis stroke="var(--admin-text-muted)" fontSize={12} />
                                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                                            <Tooltip 
                                                contentStyle={{ backgroundColor: "#0a1628", borderColor: "rgba(0, 240, 255, 0.2)", borderRadius: 8, color: "#fff" }}
                                                itemStyle={{ color: "#fff" }}
                                            />
                                            <Area type="monotone" dataKey="value" stroke="var(--admin-cyan)" strokeWidth={3} fillOpacity={1} fill="url(#colorValue)" name="Primary Metric" />
                                            <Area type="monotone" dataKey="secondary" stroke="rgba(255,255,255,0.5)" strokeWidth={2} fillOpacity={1} fill="url(#colorSec)" name="Secondary Metric" />
                                        </AreaChart>
                                    </ResponsiveContainer>
                                </div>

                                {/* Table Preview */}
                                <div>
                                    <h3 style={{ fontSize: 16, color: "var(--admin-text)", margin: "0 0 16px" }}>Raw Data Preview</h3>
                                    <table className="admin-table">
                                        <thead>
                                            <tr>
                                                <th>Date</th>
                                                <th>Primary Value</th>
                                                <th>Secondary Value</th>
                                                <th>Status</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {reportData.points.slice(0, 5).map((p: any, i: any) => (
                                                <tr key={i}>
                                                    <td>{new Date(p.date).toLocaleDateString()}</td>
                                                    <td style={{ fontWeight: 600, color: "var(--admin-text)" }}>{p.value.toLocaleString()}</td>
                                                    <td>{p.secondary.toLocaleString()}</td>
                                                    <td>
                                                        <span className="admin-badge admin-badge--dim">Recorded</span>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                    <div style={{ textAlign: "center", padding: 16 }}>
                                        <button className="admin-btn admin-btn--ghost admin-btn--sm" onClick={() => handleExport('csv')}>
                                            Export full dataset ({reportData.points.length} rows) to view all
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ) : null}
                    </div>

                </div>
            </div>
        </div>
    );
}
