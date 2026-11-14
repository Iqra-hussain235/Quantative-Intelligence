"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useBusiness } from "@/context/BusinessContext";
import API from "@/config/api";
import {
  DollarSign, ShoppingBag, Users, TrendingUp, Plus, UploadCloud,
  FileSpreadsheet, CheckCircle2, AlertCircle, Clock,
} from "lucide-react";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend,
} from "recharts";

export default function AnalyticsPage() {
  const router = useRouter();
  const { isDemo, selected, hasMLData, mlAnalytics, refreshMLAnalytics } = useBusiness();
  const [imports, setImports] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadMsg, setUploadMsg] = useState(null);

  const currency = selected?.currency || "USD";
  const fmt = (v) => v == null ? "—" : `${currency} ${Number(v).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;

  const r = hasMLData ? mlAnalytics?.mlResults || {} : {};
  const insights = r.insights || {};
  const kpis = mlAnalytics?.kpis || {};
  const charts = r.charts || {};

  useEffect(() => {
    if (!selected?.id || isDemo) return;
    API.get(`/businesses/${selected.id}/imports`)
      .then((res) => setImports(res.data))
      .catch(() => setImports({ imports: [] }));
  }, [selected?.id, isDemo, hasMLData]);

  const onUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !selected?.id) return;
    setUploading(true); setUploadMsg(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      await API.post(`/businesses/${selected.id}/ml-upload`, fd, {
        headers: { "Content-Type": "multipart/form-data" },
        timeout: 180000,
      });
      setUploadMsg({ ok: true, text: "File imported — history updated and ML analytics recalculated." });
      refreshMLAnalytics?.();
      API.get(`/businesses/${selected.id}/imports`).then((res) => setImports(res.data)).catch(() => { });
    } catch (err) {
      setUploadMsg({ ok: false, text: err.response?.data?.message || err.message || "Upload failed." });
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  if (isDemo || !selected?.id) {
    return (
      <div className="q-page-shell">
        <h1 className="q-page-title">Analytics</h1>
        <div style={{ maxWidth: 520, margin: "60px auto", textAlign: "center" }}>
          <DollarSign size={40} style={{ opacity: 0.25, marginBottom: 16 }} />
          <h2 style={{ fontWeight: 700, fontSize: "1.25rem", marginBottom: 10 }}>{isDemo ? "Demo mode" : "Select a business"}</h2>
          <p style={{ color: "var(--q-text-3)", lineHeight: 1.7, marginBottom: 24 }}>
            {isDemo ? "Analytics are computed from your real business data. Exit demo mode to view them." : "Select or create a business to see accumulated analytics."}
          </p>
          <button onClick={() => router.push("/businesses")} className="q-btn q-btn-primary q-btn-sm" style={{ gap: 6 }}>
            <Plus size={14} /> {isDemo ? "Exit Demo" : "Go to Businesses"}
          </button>
        </div>
      </div>
    );
  }

  const revenueChart = (charts.revenue || []).map((c) => ({ month: String(c.month).slice(0, 7), revenue: c.revenue }));
  const categoryChart = (charts.category || []).slice(0, 8);
  const orderList = insights.orders || {};

  return (
    <div className="q-page-shell">
      <div className="q-page-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 className="q-page-title">Analytics</h1>
          <p className="q-page-subtitle">
            {selected.businessName} · accumulated history{imports?.totalRecords ? ` · ${imports.totalRecords.toLocaleString()} records` : ""}
            {mlAnalytics?.processedAt ? ` · last analysis ${new Date(mlAnalytics.processedAt).toLocaleString()}` : ""}
          </p>
        </div>
        <label className="q-btn q-btn-primary q-btn-sm" style={{ gap: 6, cursor: uploading ? "wait" : "pointer" }}>
          <UploadCloud size={14} /> {uploading ? "Importing…" : "Import Data"}
          <input type="file" accept=".csv,.xlsx,.xls" style={{ display: "none" }} onChange={onUpload} disabled={uploading} />
        </label>
      </div>

      {uploadMsg && (
        <div style={{
          padding: "12px 16px", borderRadius: 10, marginBottom: 20, fontSize: "0.85rem", display: "flex", gap: 8, alignItems: "center",
          background: uploadMsg.ok ? "#ECFDF5" : "#FEF2F2", border: `1px solid ${uploadMsg.ok ? "#A7F3D0" : "#FCA5A5"}`, color: uploadMsg.ok ? "#065F46" : "#991B1B"
        }}>
          {uploadMsg.ok ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />} {uploadMsg.text}
        </div>
      )}

      {!hasMLData ? (
        <div className="q-card" style={{ padding: "48px 24px", textAlign: "center", maxWidth: 560, margin: "30px auto" }}>
          <FileSpreadsheet size={40} style={{ opacity: 0.25, marginBottom: 16 }} />
          <h3 style={{ fontWeight: 700, fontSize: "1.1rem", marginBottom: 8 }}>No data imported yet</h3>
          <p style={{ color: "var(--q-text-3)", fontSize: "0.87rem", lineHeight: 1.6, marginBottom: 20 }}>
            Import a CSV/Excel sales file — records accumulate across uploads and every metric updates automatically.
          </p>
          <label className="q-btn q-btn-primary q-btn-sm" style={{ gap: 6, cursor: "pointer" }}>
            <UploadCloud size={14} /> Import Your First File
            <input type="file" accept=".csv,.xlsx,.xls" style={{ display: "none" }} onChange={onUpload} disabled={uploading} />
          </label>
        </div>
      ) : (
        <>
          {/* KPIs */}
          <div className="q-kpi-grid" style={{ marginBottom: 24 }}>
            {[
              { label: "Total Revenue", value: fmt(kpis.total_revenue ?? orderList.total_sales), icon: DollarSign, color: "#2563EB" },
              { label: "Total Orders", value: (orderList.total_orders ?? "—").toLocaleString?.() ?? "—", icon: ShoppingBag, color: "#0891B2" },
              { label: "Avg Order Value", value: fmt(orderList.avg_order_value ?? kpis.average_order_value), icon: TrendingUp, color: "#D97706" },
              { label: "Customers", value: (insights.customer_analytics?.identified_customers ?? kpis.customer_count ?? "—").toLocaleString?.() ?? "—", icon: Users, color: "#7C3AED" },
              { label: "Gross Margin", value: insights.profitability?.gross_margin_pct != null ? `${Number(insights.profitability.gross_margin_pct).toFixed(1)}%` : "—", icon: TrendingUp, color: "#059669" },
              { label: "Anomaly Rate", value: kpis.anomaly_percentage != null ? `${kpis.anomaly_percentage}%` : "—", icon: AlertCircle, color: "#DC2626" },
            ].map((s) => (
              <div key={s.label} className="q-card" style={{ padding: "16px 18px", display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ width: 38, height: 38, borderRadius: 10, background: s.color + "18", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <s.icon size={17} style={{ color: s.color }} />
                </div>
                <div>
                  <div style={{ fontSize: "0.7rem", color: "var(--q-text-4)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>{s.label}</div>
                  <div style={{ fontWeight: 800, fontSize: "1.15rem" }}>{s.value}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Charts */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))", gap: 20, marginBottom: 24 }}>
            {revenueChart.length > 0 && (
              <div className="q-card" style={{ padding: 20 }}>
                <h3 style={{ fontWeight: 700, fontSize: "0.9rem", marginBottom: 14 }}>Monthly Revenue (full history)</h3>
                <ResponsiveContainer width="100%" height={220}>
                  <AreaChart data={revenueChart}>
                    <defs>
                      <linearGradient id="revG2" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#2563EB" stopOpacity={0.15} />
                        <stop offset="95%" stopColor="#2563EB" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--q-border)" vertical={false} />
                    <XAxis dataKey="month" tick={{ fontSize: 10, fill: "var(--q-text-4)" }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: "var(--q-text-4)" }} axisLine={false} tickLine={false} width={55} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                    <Tooltip formatter={(v) => fmt(v)} contentStyle={{ borderRadius: 8, border: "1px solid var(--q-border)" }} />
                    <Area type="monotone" dataKey="revenue" stroke="#2563EB" fill="url(#revG2)" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
            {categoryChart.length > 0 && (
              <div className="q-card" style={{ padding: 20 }}>
                <h3 style={{ fontWeight: 700, fontSize: "0.9rem", marginBottom: 14 }}>Sales by Category</h3>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={categoryChart} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--q-border)" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 10, fill: "var(--q-text-4)" }} axisLine={false} tickLine={false} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                    <YAxis type="category" dataKey="category" tick={{ fontSize: 11, fill: "var(--q-text-4)" }} axisLine={false} tickLine={false} width={90} />
                    <Tooltip formatter={(v) => fmt(v)} contentStyle={{ borderRadius: 8, border: "1px solid var(--q-border)" }} />
                    <Bar dataKey="sales" fill="#059669" radius={[0, 3, 3, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {/* Import history */}
          <div className="q-card" style={{ padding: 0, overflow: "hidden" }}>
            <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--q-border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <h3 style={{ fontWeight: 700, fontSize: "0.95rem" }}>Import History</h3>
                <p style={{ fontSize: "0.78rem", color: "var(--q-text-4)", marginTop: 2 }}>Every upload is preserved — overlapping records are merged, never duplicated.</p>
              </div>
              <span className="q-badge q-badge-neutral">{imports?.imports?.length ?? 0} imports</span>
            </div>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.83rem" }}>
                <thead>
                  <tr style={{ background: "var(--q-surface-2)", textAlign: "left" }}>
                    {["File", "Imported", "Date Range", "Rows", "New", "Updated", "Duplicates", "Status"].map((h) => (
                      <th key={h} style={{ padding: "11px 16px", fontWeight: 700, fontSize: "0.7rem", color: "var(--q-text-4)", textTransform: "uppercase", letterSpacing: "0.05em", whiteSpace: "nowrap" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(imports?.imports || []).map((imp) => (
                    <tr key={imp.id} style={{ borderTop: "1px solid var(--q-border)" }}>
                      <td style={{ padding: "10px 16px", fontWeight: 600, maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{imp.fileName}</td>
                      <td style={{ padding: "10px 16px", color: "var(--q-text-4)", whiteSpace: "nowrap" }}>{imp.createdAt ? new Date(imp.createdAt).toLocaleString() : "—"}</td>
                      <td style={{ padding: "10px 16px", whiteSpace: "nowrap", color: "var(--q-text-3)" }}>
                        {imp.dateRangeStart || "?"} → {imp.dateRangeEnd || "?"}
                      </td>
                      <td style={{ padding: "10px 16px" }}>{imp.totalRows?.toLocaleString() ?? "—"}</td>
                      <td style={{ padding: "10px 16px", color: "#059669", fontWeight: 600 }}>{imp.newRows ?? "—"}</td>
                      <td style={{ padding: "10px 16px", color: "#2563EB" }}>{imp.updatedRows ?? 0}</td>
                      <td style={{ padding: "10px 16px", color: "var(--q-text-4)" }}>{imp.duplicateRows ?? 0}</td>
                      <td style={{ padding: "10px 16px" }}>
                        <span className={`q-badge ${imp.status === "completed" ? "q-badge-success" : "q-badge-danger"}`}>
                          {imp.status === "completed" ? "Completed" : imp.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {(!imports?.imports || imports.imports.length === 0) && (
                    <tr><td colSpan={8} style={{ padding: "24px", textAlign: "center", color: "var(--q-text-4)" }}>No imports recorded yet.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
