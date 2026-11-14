"use client";
/**
 * ML Analytics Dashboard
 * ──────────────────────────────────────────────────────────────────────────────
 * Displays real ML-generated results from the FastAPI pipeline.
 * Shows KPIs, revenue/trend/category/region/anomaly charts, and alerts.
 * Includes a CSV/Excel upload widget to trigger the ML pipeline.
 * Never shows fabricated metrics — renders empty states when data is absent.
 */

import { useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useBusiness } from "@/context/BusinessContext";
import API from "@/config/api";
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line,
  PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import {
  Upload, AlertTriangle, TrendingUp, Users, DollarSign,
  Activity, BarChart3, RefreshCw, CheckCircle, XCircle,
  Loader2, FileText, ChevronRight, Info,
  Clock, Award, UserCheck, Lightbulb, Receipt, Coffee,
} from "lucide-react";

// ── Colour palette ────────────────────────────────────────────────────────────
const COLORS = ["#2563EB", "#059669", "#7C3AED", "#D97706", "#DC2626", "#0891B2"];

// ── Number formatter ──────────────────────────────────────────────────────────
const fmt = (v, prefix = "") => {
  if (v == null) return "—";
  const n = Number(v);
  if (isNaN(n)) return "—";
  if (n >= 1_000_000) return `${prefix}${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 100_000) return `${prefix}${(n / 100_000).toFixed(1)}L`;
  if (n >= 1_000) return `${prefix}${(n / 1_000).toFixed(0)}K`;
  return `${prefix}${n.toFixed(2)}`;
};

// ── Stat card ─────────────────────────────────────────────────────────────────
function StatCard({ label, value, icon: Icon, color, sub }) {
  return (
    <div className="q-kpi-card" style={{ cursor: "default" }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 14 }}>
        <span className="q-kpi-label">{label}</span>
        <div style={{ width: 34, height: 34, borderRadius: 8, background: color + "18", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Icon size={16} style={{ color }} />
        </div>
      </div>
      <div className="q-kpi-value" style={{ color: value === "—" ? "var(--q-text-4)" : undefined }}>
        {value}
      </div>
      {sub && (
        <div style={{ marginTop: 6, fontSize: "0.8125rem", color: "var(--q-text-4)" }}>{sub}</div>
      )}
    </div>
  );
}

// ── Section card ──────────────────────────────────────────────────────────────
function Section({ title, sub, children }) {
  return (
    <div className="q-card" style={{ marginBottom: 24 }}>
      <div style={{ padding: "18px 24px", borderBottom: "1px solid var(--q-border)" }}>
        <h3 style={{ fontWeight: 700, fontSize: "1rem" }}>{title}</h3>
        {sub && <p style={{ fontSize: "0.8125rem", color: "var(--q-text-3)", marginTop: 3 }}>{sub}</p>}
      </div>
      <div style={{ padding: "20px 24px" }}>{children}</div>
    </div>
  );
}

// ── Upload widget ─────────────────────────────────────────────────────────────
function UploadWidget({ businessId, onSuccess }) {
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState(null); // {ok, message}
  const inputRef = useRef(null);

  const doUpload = useCallback(async (file) => {
    if (!file) return;
    const ext = file.name.split(".").pop().toLowerCase();
    if (!["csv", "xlsx", "xls", "json", "parquet"].includes(ext)) {
      setResult({ ok: false, message: "Unsupported file type. Use CSV or Excel." });
      return;
    }
    setUploading(true);
    setResult(null);
    const form = new FormData();
    form.append("file", file);
    try {
      const res = await API.post(
        `/businesses/${businessId}/ml-upload`,
        form,
        { headers: { "Content-Type": "multipart/form-data" }, timeout: 180_000 }
      );
      setResult({
        ok: true,
        message: `Processed ${res.data?.summary?.total_records ?? "?"} rows. ML results saved.`,
      });
      onSuccess?.();
    } catch (err) {
      const msg =
        err.response?.data?.message || err.message || "Upload failed.";
      setResult({ ok: false, message: msg });
    } finally {
      setUploading(false);
    }
  }, [businessId, onSuccess]);

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => { e.preventDefault(); setDragging(false); doUpload(e.dataTransfer.files[0]); }}
      style={{
        border: `2px dashed ${dragging ? "#2563EB" : "var(--q-border)"}`,
        borderRadius: 14,
        padding: "40px 24px",
        textAlign: "center",
        background: dragging ? "#EFF6FF" : "var(--q-surface)",
        transition: "all 0.2s",
        cursor: "pointer",
      }}
      onClick={() => inputRef.current?.click()}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".csv,.xlsx,.xls,.json,.parquet"
        style={{ display: "none" }}
        onChange={(e) => doUpload(e.target.files[0])}
      />

      {uploading ? (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
          <Loader2 size={32} className="q-spin" style={{ color: "#2563EB" }} />
          <div style={{ fontWeight: 600, color: "var(--q-text-2)" }}>Running ML pipeline…</div>
          <div style={{ fontSize: "0.875rem", color: "var(--q-text-4)" }}>
            This may take up to 2 minutes for large files.
          </div>
        </div>
      ) : (
        <>
          <Upload size={32} style={{ color: "#2563EB", marginBottom: 12 }} />
          <div style={{ fontWeight: 600, color: "var(--q-text-2)", marginBottom: 6 }}>
            Drop your CSV / Excel file here
          </div>
          <div style={{ fontSize: "0.875rem", color: "var(--q-text-4)" }}>
            or click to browse — supports .csv, .xlsx, .xls, .json, .parquet
          </div>
        </>
      )}

      {result && (
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            marginTop: 16,
            padding: "10px 16px",
            borderRadius: 8,
            background: result.ok ? "#ECFDF5" : "#FEF2F2",
            border: `1px solid ${result.ok ? "#6EE7B7" : "#FCA5A5"}`,
            display: "flex",
            alignItems: "center",
            gap: 8,
            textAlign: "left",
          }}
        >
          {result.ok
            ? <CheckCircle size={16} color="#059669" />
            : <XCircle size={16} color="#DC2626" />}
          <span style={{ fontSize: "0.875rem", color: result.ok ? "#065F46" : "#991B1B" }}>
            {result.message}
          </span>
        </div>
      )}
    </div>
  );
}

// ── Alert banner ──────────────────────────────────────────────────────────────
function AlertBanner({ alerts }) {
  if (!alerts || alerts.length === 0) return null;
  return (
    <div style={{ marginBottom: 24 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
        <AlertTriangle size={18} color="#DC2626" />
        <h2 style={{ fontSize: "1.125rem", fontWeight: 700 }}>ML Alerts</h2>
        <span className="q-badge q-badge-danger">{alerts.length}</span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {alerts.map((a, i) => (
          <div
            key={i}
            style={{
              padding: "14px 18px",
              background: a.severity === "warning" ? "#FFFBEB" : "#EFF6FF",
              border: `1px solid ${a.severity === "warning" ? "#FDE68A" : "#BFDBFE"}`,
              borderRadius: 10,
              display: "flex",
              gap: 12,
              alignItems: "flex-start",
            }}
          >
            {a.severity === "warning"
              ? <AlertTriangle size={16} color="#D97706" style={{ flexShrink: 0, marginTop: 2 }} />
              : <Info size={16} color="#2563EB" style={{ flexShrink: 0, marginTop: 2 }} />
            }
            <div>
              <div style={{ fontWeight: 600, fontSize: "0.9rem", marginBottom: 2 }}>
                {a.type === "anomaly" ? "Anomaly Detected" : "Status Update"}
              </div>
              <div style={{ fontSize: "0.875rem", color: "var(--q-text-3)" }}>{a.message}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function MLAnalyticsPage() {
  const router = useRouter();
  const {
    selected, isDemo, hasMLData, mlAnalytics, mlLoading,
    refreshMLAnalytics, businessName,
  } = useBusiness();

  if (!selected) {
    return (
      <div className="q-page-shell">
        <div style={{ maxWidth: 500, margin: "60px auto", textAlign: "center" }}>
          <div style={{ fontSize: "3rem", marginBottom: 16 }}>📊</div>
          <h1 style={{ fontWeight: 700, fontSize: "1.5rem", marginBottom: 12 }}>ML Analytics</h1>
          <p style={{ color: "var(--q-text-3)", lineHeight: 1.7 }}>
            Select or create a business first, then upload your dataset to see ML-generated insights.
          </p>
          <button onClick={() => router.push("/businesses/new")} className="q-btn q-btn-primary" style={{ marginTop: 20, gap: 8 }}>
            Get Started
          </button>
        </div>
      </div>
    );
  }

  if (isDemo) {
    return (
      <div className="q-page-shell">
        <div className="q-page-header">
          <h1 className="q-page-title">ML Analytics</h1>
          <p className="q-page-subtitle">NovaMart (Demo) · ML analytics require real uploaded data</p>
        </div>
        <div style={{ padding: "48px 24px", textAlign: "center", background: "var(--q-surface)", border: "1px solid var(--q-border)", borderRadius: 14 }}>
          <div style={{ fontSize: "2.5rem", marginBottom: 16 }}>🤖</div>
          <h2 style={{ fontWeight: 700, fontSize: "1.375rem", marginBottom: 10 }}>ML Analytics require your real data</h2>
          <p style={{ color: "var(--q-text-3)", lineHeight: 1.7, maxWidth: 440, margin: "0 auto 24px" }}>
            The ML pipeline (Modules 1-9) analyses real CSV/Excel datasets. Switch to your own business and upload a file to generate actual KPIs, trends, anomalies, and alerts.
          </p>
          <button onClick={() => router.push("/businesses/new")} className="q-btn q-btn-primary" style={{ gap: 8 }}>
            Use My Data
          </button>
        </div>
      </div>
    );
  }

  const mlData = mlAnalytics?.mlResults;
  const kpis = mlAnalytics?.kpis || {};
  const charts = mlData?.charts || {};
  const alerts = mlData?.alerts || [];
  const anomaly = mlData?.anomaly_summary || {};
  const anomalyRecords = mlData?.anomaly_records || anomaly.records || [];
  const cleaning = mlData?.cleaning_report || {};
  const insights = mlData?.insights || {};
  const uploadInfo = mlAnalytics?.uploadInfo;
  const currency = selected?.currency || "USD";

  const revenueChart = charts.revenue || [];
  const categoryChart = charts.category || [];
  const regionChart = charts.region || [];
  const trendChart = charts.trend || [];
  const momChart = charts.mom_growth || [];

  const anomalyPieData = anomaly.total_records
    ? [
      { name: "Normal", value: anomaly.normal_records || 0 },
      { name: "Anomaly", value: anomaly.anomaly_count || 0 },
    ]
    : [];

  return (
    <div className="q-page-shell">
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12, marginBottom: 28 }}>
        <div>
          <h1 style={{ fontSize: "1.625rem", fontWeight: 700, color: "var(--q-text-1)", marginBottom: 6 }}>
            ML Analytics
          </h1>
          <p style={{ color: "var(--q-text-3)", fontSize: "0.9375rem" }}>
            {businessName} · Powered by Modules 1–10 (FastAPI pipeline)
            {mlAnalytics?.processedAt && (
              <span style={{ marginLeft: 10, color: "var(--q-text-4)", fontSize: "0.8rem", display: "inline-flex", alignItems: "center", gap: 4 }}>
                <Clock size={12} /> Last analyzed {new Date(mlAnalytics.processedAt).toLocaleString()}
              </span>
            )}
          </p>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          {hasMLData && (
            <button
              className="q-btn q-btn-outline q-btn-sm"
              onClick={refreshMLAnalytics}
              disabled={mlLoading}
              style={{ gap: 6 }}
            >
              <RefreshCw size={14} className={mlLoading ? "q-spin" : ""} />
              Refresh
            </button>
          )}
        </div>
      </div>

      {/* Upload widget (always shown) */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
          <FileText size={18} color="#2563EB" />
          <h2 style={{ fontSize: "1.125rem", fontWeight: 700 }}>
            {hasMLData ? "Upload New Dataset" : "Upload Dataset to Run ML Pipeline"}
          </h2>
        </div>
        {uploadInfo && (
          <div style={{ padding: "10px 16px", background: "var(--q-surface-2)", borderRadius: 10, marginBottom: 12, display: "flex", gap: 10, alignItems: "center", fontSize: "0.875rem", color: "var(--q-text-3)" }}>
            <CheckCircle size={14} color="#059669" />
            Last processed: <strong style={{ color: "var(--q-text-1)" }}>{uploadInfo.originalName}</strong>
            &nbsp;·&nbsp; {uploadInfo.cleanedRecords?.toLocaleString() ?? "?"} clean rows
            &nbsp;·&nbsp; {new Date(uploadInfo.uploadedAt).toLocaleDateString()}
          </div>
        )}
        <UploadWidget
          businessId={selected.id}
          onSuccess={() => {
            setTimeout(() => refreshMLAnalytics(), 500);
          }}
        />
      </div>

      {/* Loading */}
      {mlLoading && (
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "24px", color: "var(--q-text-3)", justifyContent: "center" }}>
          <Loader2 size={20} className="q-spin" />
          Fetching ML analytics…
        </div>
      )}

      {/* No data yet */}
      {!mlLoading && !hasMLData && (
        <div style={{ padding: "48px 24px", textAlign: "center", background: "var(--q-surface)", border: "1px solid var(--q-border)", borderRadius: 14 }}>
          <div style={{ fontSize: "2.5rem", marginBottom: 14, opacity: 0.3 }}>📂</div>
          <h2 style={{ fontWeight: 700, fontSize: "1.25rem", marginBottom: 10 }}>No ML results yet</h2>
          <p style={{ color: "var(--q-text-3)", lineHeight: 1.7, maxWidth: 440, margin: "0 auto" }}>
            Upload a CSV or Excel file above to run the full ML pipeline (data ingestion → cleaning → KPIs → trend → anomaly detection → alerts).
          </p>
        </div>
      )}

      {/* ── ML Results ──────────────────────────────────────────────────────── */}
      {!mlLoading && hasMLData && (
        <>
          {/* Alerts from ML */}
          <AlertBanner alerts={alerts} />

          {/* KPI Cards */}
          <div className="q-kpi-grid" style={{ marginBottom: 28 }}>
            <StatCard
              label="Total Revenue"
              value={fmt(kpis.total_revenue, "$")}
              icon={DollarSign}
              color="#2563EB"
              sub="From ML pipeline (Module 3)"
            />
            <StatCard
              label="Customer Count"
              value={kpis.customer_count != null ? kpis.customer_count.toLocaleString() : "—"}
              icon={Users}
              color="#7C3AED"
              sub="Unique customers"
            />
            <StatCard
              label="Profit Margin"
              value={kpis.profit_margin != null ? `${Number(kpis.profit_margin).toFixed(2)}%` : "—"}
              icon={TrendingUp}
              color="#059669"
              sub="(Profit / Revenue) × 100"
            />
            <StatCard
              label="Avg Order Value"
              value={fmt(kpis.average_order_value, "$")}
              icon={Activity}
              color="#D97706"
              sub="Total Sales / Unique Orders"
            />
            <StatCard
              label="Total Orders"
              value={insights?.orders?.total_orders != null ? Number(insights.orders.total_orders).toLocaleString() : "—"}
              icon={Receipt}
              color="#0891B2"
              sub="Unique order IDs in dataset"
            />
            <StatCard
              label="Anomaly %"
              value={kpis.anomaly_percentage != null ? `${Number(kpis.anomaly_percentage).toFixed(2)}%` : "—"}
              icon={AlertTriangle}
              color="#DC2626"
              sub={`${kpis.anomaly_count ?? 0} anomalous records`}
            />
          </div>

          {/* Revenue trend chart */}
          {revenueChart.length > 0 && (
            <Section title="Monthly Revenue Trend" sub="Calculated by Module 3 · KPI Engine">
              <ResponsiveContainer width="100%" height={260}>
                <AreaChart data={revenueChart}>
                  <defs>
                    <linearGradient id="revG" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#2563EB" stopOpacity={0.15} />
                      <stop offset="95%" stopColor="#2563EB" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--q-border)" vertical={false} />
                  <XAxis dataKey="month" tick={{ fontSize: 12, fill: "var(--q-text-4)" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 12, fill: "var(--q-text-4)" }} axisLine={false} tickLine={false} tickFormatter={(v) => fmt(v, "$")} width={72} />
                  <Tooltip formatter={(v) => [fmt(v, "$"), "Revenue"]} contentStyle={{ borderRadius: 8, border: "1px solid var(--q-border)" }} />
                  <Area type="monotone" dataKey="revenue" name="Revenue" stroke="#2563EB" strokeWidth={2.5} fill="url(#revG)" />
                </AreaChart>
              </ResponsiveContainer>
            </Section>
          )}

          {/* Trend vs Actual (Module 4) */}
          {trendChart.length > 0 && (
            <Section title="Trend & Seasonality Decomposition" sub="STL decomposition by Module 4 · statsmodels">
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={trendChart}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--q-border)" vertical={false} />
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: "var(--q-text-4)" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 12, fill: "var(--q-text-4)" }} axisLine={false} tickLine={false} tickFormatter={(v) => fmt(v, "$")} width={72} />
                  <Tooltip formatter={(v) => (v != null ? [fmt(v, "$")] : ["—"])} contentStyle={{ borderRadius: 8, border: "1px solid var(--q-border)" }} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Line type="monotone" dataKey="actual" name="Actual" stroke="#2563EB" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="trend" name="Trend" stroke="#059669" strokeWidth={2} dot={false} strokeDasharray="5 3" />
                  <Line type="monotone" dataKey="seasonal" name="Seasonal" stroke="#D97706" strokeWidth={1.5} dot={false} strokeDasharray="2 2" />
                </LineChart>
              </ResponsiveContainer>
            </Section>
          )}

          {/* Category & Region charts side by side */}
          {(categoryChart.length > 0 || regionChart.length > 0) && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 24 }}>
              {categoryChart.length > 0 && (
                <div className="q-card">
                  <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--q-border)" }}>
                    <h3 style={{ fontWeight: 700, fontSize: "0.9375rem" }}>Sales by Category</h3>
                  </div>
                  <div style={{ padding: "16px 20px" }}>
                    <ResponsiveContainer width="100%" height={220}>
                      <BarChart data={categoryChart}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--q-border)" vertical={false} />
                        <XAxis dataKey="category" tick={{ fontSize: 11, fill: "var(--q-text-4)" }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fontSize: 11, fill: "var(--q-text-4)" }} axisLine={false} tickLine={false} tickFormatter={(v) => fmt(v, "$")} width={60} />
                        <Tooltip formatter={(v) => [fmt(v, "$"), "Sales"]} contentStyle={{ borderRadius: 8, border: "1px solid var(--q-border)" }} />
                        <Bar dataKey="sales" radius={[4, 4, 0, 0]}>
                          {categoryChart.map((_, i) => (
                            <Cell key={i} fill={COLORS[i % COLORS.length]} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}

              {regionChart.length > 0 && (
                <div className="q-card">
                  <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--q-border)" }}>
                    <h3 style={{ fontWeight: 700, fontSize: "0.9375rem" }}>Sales by Region</h3>
                  </div>
                  <div style={{ padding: "16px 20px" }}>
                    <ResponsiveContainer width="100%" height={220}>
                      <BarChart data={regionChart} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--q-border)" horizontal={false} />
                        <XAxis type="number" tick={{ fontSize: 11, fill: "var(--q-text-4)" }} axisLine={false} tickLine={false} tickFormatter={(v) => fmt(v, "$")} />
                        <YAxis type="category" dataKey="region" tick={{ fontSize: 11, fill: "var(--q-text-4)" }} axisLine={false} tickLine={false} width={70} />
                        <Tooltip formatter={(v) => [fmt(v, "$"), "Sales"]} contentStyle={{ borderRadius: 8, border: "1px solid var(--q-border)" }} />
                        <Bar dataKey="sales" radius={[0, 4, 4, 0]}>
                          {regionChart.map((_, i) => (
                            <Cell key={i} fill={COLORS[i % COLORS.length]} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* MoM Growth */}
          {momChart.length > 0 && (
            <Section title="Month-over-Month Revenue Growth %" sub="Calculated by Module 3 · KPI Engine">
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={momChart}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--q-border)" vertical={false} />
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: "var(--q-text-4)" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 12, fill: "var(--q-text-4)" }} axisLine={false} tickLine={false} tickFormatter={(v) => (v != null ? `${v.toFixed(1)}%` : "—")} />
                  <Tooltip formatter={(v) => (v != null ? [`${Number(v).toFixed(2)}%`, "MoM Growth"] : ["—", "MoM Growth"])} contentStyle={{ borderRadius: 8, border: "1px solid var(--q-border)" }} />
                  <Bar dataKey="growth_pct" name="MoM Growth %" radius={[4, 4, 0, 0]}>
                    {momChart.map((entry, i) => (
                      <Cell key={i} fill={(entry.growth_pct ?? 0) >= 0 ? "#059669" : "#DC2626"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </Section>
          )}

          {/* ── Module 10: Restaurant/Cafe business insights ────────────────── */}

          {/* Best-selling items */}
          {(insights.best_selling_items || []).length > 0 && (
            <Section title="Best-Selling Menu Items" sub="Ranked by total sales — Module 10">
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {insights.best_selling_items.map((item, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", background: "var(--q-surface-2)", borderRadius: 8 }}>
                    <span style={{ width: 26, height: 26, borderRadius: 7, background: "#FEF3C7", color: "#D97706", fontSize: "0.75rem", fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{i + 1}</span>
                    <Award size={15} color="#D97706" style={{ flexShrink: 0 }} />
                    <span style={{ flex: 1, fontSize: "0.875rem", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {item.product}{item.sku ? <span style={{ color: "var(--q-text-4)", fontWeight: 400, fontSize: "0.78rem" }}> · {item.sku}</span> : null}
                    </span>
                    <span style={{ fontSize: "0.8rem", color: "var(--q-text-4)" }}>{item.orders} orders{item.quantity != null ? ` · ${item.quantity} qty` : ""}</span>
                    <span style={{ fontWeight: 700, fontSize: "0.9rem" }}>{currency} {Number(item.sales).toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                  </div>
                ))}
              </div>
            </Section>
          )}

          {/* Category performance table */}
          {(insights.category_performance || []).length > 0 && (
            <Section title="Food Category Performance" sub="Sales share by category — Module 10">
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {insights.category_performance.map((c) => (
                  <div key={c.category}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4, fontSize: "0.85rem" }}>
                      <span style={{ fontWeight: 600 }}>{c.category}</span>
                      <span style={{ color: "var(--q-text-3)" }}>
                        {currency} {Number(c.sales).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                        {c.share_pct != null && <span style={{ marginLeft: 8, color: "var(--q-text-4)" }}>{c.share_pct}%</span>}
                      </span>
                    </div>
                    <div className="q-progress-track" style={{ height: 6 }}>
                      <div style={{ height: "100%", width: `${Math.min(c.share_pct ?? 0, 100)}%`, background: "#2563EB", borderRadius: 3 }} />
                    </div>
                  </div>
                ))}
              </div>
            </Section>
          )}

          {/* Peak hours */}
          {insights.peak_hours?.available === false && (
            <Section title="Peak Business Hours" sub="Module 10">
              <div className="q-empty" style={{ padding: "20px 0", textAlign: "center" }}>
                <Clock size={28} style={{ opacity: 0.3, marginBottom: 10 }} />
                <div style={{ fontSize: "0.85rem", color: "var(--q-text-4)" }}>{insights.peak_hours.reason || "No time-of-day data available."}</div>
              </div>
            </Section>
          )}
          {(insights.peak_hours?.hourly || []).length > 0 && (
            <Section
              title="Peak Business Hours"
              sub={insights.peak_hours.peak_label
                ? `Busiest window: ${insights.peak_hours.peak_label} (${insights.peak_hours.peak_orders} orders) — Module 10`
                : "Orders by hour of day — Module 10"}
            >
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={insights.peak_hours.hourly}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--q-border)" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 10, fill: "var(--q-text-4)" }} axisLine={false} tickLine={false} interval={2} />
                  <YAxis tick={{ fontSize: 11, fill: "var(--q-text-4)" }} axisLine={false} tickLine={false} width={45} />
                  <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid var(--q-border)" }} formatter={(v, n) => [v, n === "orders" ? "Orders" : "Sales"]} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="orders" name="Orders" fill="#DC2626" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </Section>
          )}

          {/* Customer analytics */}
          {insights.customer_analytics && (
            <Section title="Customer Analytics" sub="Repeat behaviour & top customers — Module 10">
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 12, marginBottom: insights.customer_analytics.top_customers?.length ? 20 : 0 }}>
                {[
                  { label: "Identified Customers", value: (insights.customer_analytics.identified_customers ?? insights.customer_analytics.unique_customers)?.toLocaleString() ?? "—", icon: Users, color: "#7C3AED" },
                  { label: "Repeat Rate", value: insights.customer_analytics.repeat_customer_rate_pct != null ? `${insights.customer_analytics.repeat_customer_rate_pct}%` : "—", icon: UserCheck, color: "#059669" },
                  { label: "Avg Orders / Customer", value: insights.customer_analytics.avg_orders_per_customer ?? "—", icon: Receipt, color: "#D97706" },
                  { label: "Walk-in Orders", value: insights.customer_analytics.walk_in_orders != null ? Number(insights.customer_analytics.walk_in_orders).toLocaleString() : "—", icon: Coffee, color: "#0891B2" },
                ].map((s) => (
                  <div key={s.label} style={{ padding: "14px 16px", background: "var(--q-surface-2)", borderRadius: 10, display: "flex", alignItems: "center", gap: 12 }}>
                    <div style={{ width: 36, height: 36, borderRadius: 9, background: s.color + "18", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <s.icon size={17} style={{ color: s.color }} />
                    </div>
                    <div>
                      <div style={{ fontSize: "1.05rem", fontWeight: 800 }}>{s.value}</div>
                      <div style={{ fontSize: "0.72rem", color: "var(--q-text-4)" }}>{s.label}</div>
                    </div>
                  </div>
                ))}
              </div>
              {(insights.customer_analytics.top_customers || []).length > 0 && (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {insights.customer_analytics.top_customers.map((c, i) => (
                    <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "8px 12px", background: "var(--q-surface-2)", borderRadius: 8, fontSize: "0.85rem" }}>
                      <span style={{ fontWeight: 600 }}>{c.customer}</span>
                      <span style={{ color: "var(--q-text-3)" }}>{currency} {Number(c.total_sales).toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                    </div>
                  ))}
                </div>
              )}
            </Section>
          )}

          {/* Demand forecast */}
          {insights.demand_forecast?.available ? (
            <Section title="Demand Forecast" sub={`Linear trend · ${insights.demand_forecast.frequency || "period"} · next ${insights.demand_forecast.horizon ?? "—"} periods after ${insights.demand_forecast.last_actual_period || "latest data"} · Module 10`}>
              <ResponsiveContainer width="100%" height={240}>
                <LineChart
                  data={[
                    ...(insights.demand_forecast.history || []).map((h) => ({ month: h.period ?? h.month, actual: h.actual, forecast: null })),
                    ...(insights.demand_forecast.forecast || []).map((f) => ({ month: f.period ?? f.month, actual: null, forecast: f.forecast })),
                  ]}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--q-border)" vertical={false} />
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: "var(--q-text-4)" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: "var(--q-text-4)" }} axisLine={false} tickLine={false} width={70} tickFormatter={(v) => `${currency} ${(v / 1000).toFixed(0)}k`} />
                  <Tooltip formatter={(v) => (v != null ? [`${currency} ${Number(v).toLocaleString(undefined, { maximumFractionDigits: 0 })}`] : ["—"])} contentStyle={{ borderRadius: 8, border: "1px solid var(--q-border)" }} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Line type="monotone" dataKey="actual" name="Actual Revenue" stroke="#2563EB" strokeWidth={2} dot={false} connectNulls />
                  <Line type="monotone" dataKey="forecast" name="Forecast" stroke="#059669" strokeWidth={2} strokeDasharray="6 4" dot={{ r: 4 }} connectNulls />
                </LineChart>
              </ResponsiveContainer>
            </Section>
          ) : insights.demand_forecast && (
            <Section title="Demand Forecast" sub="Module 10">
              <div className="q-empty" style={{ padding: "24px 0", textAlign: "center" }}>
                <Coffee size={28} style={{ opacity: 0.3, marginBottom: 10 }} />
                <div style={{ fontWeight: 600, color: "var(--q-text-3)" }}>Forecast unavailable</div>
                <div style={{ fontSize: "0.85rem", color: "var(--q-text-4)", marginTop: 6 }}>{insights.demand_forecast.reason || "Insufficient historical data."}</div>
              </div>
            </Section>
          )}

          {/* Profitability */}
          {insights.profitability && (
            <Section title="Profitability Analysis" sub="Revenue, COGS & gross profit — Module 10">
              {insights.profitability.has_profit_data ? (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 14 }}>
                  <div style={{ padding: "14px 16px", background: "var(--q-surface-2)", borderRadius: 10 }}>
                    <div style={{ fontSize: "0.72rem", color: "var(--q-text-4)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>Total Revenue</div>
                    <div style={{ fontSize: "1.25rem", fontWeight: 800 }}>
                      {currency} {Number(insights.profitability.total_revenue ?? 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </div>
                  </div>
                  <div style={{ padding: "14px 16px", background: "var(--q-surface-2)", borderRadius: 10 }}>
                    <div style={{ fontSize: "0.72rem", color: "var(--q-text-4)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>COGS</div>
                    <div style={{ fontSize: "1.25rem", fontWeight: 800 }}>
                      {insights.profitability.total_cogs != null ? `${currency} ${Number(insights.profitability.total_cogs).toLocaleString(undefined, { maximumFractionDigits: 0 })}` : "—"}
                    </div>
                  </div>
                  <div style={{ padding: "14px 16px", background: "var(--q-surface-2)", borderRadius: 10 }}>
                    <div style={{ fontSize: "0.72rem", color: "var(--q-text-4)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>Gross Profit</div>
                    <div style={{ fontSize: "1.25rem", fontWeight: 800, color: (insights.profitability.gross_profit ?? 0) >= 0 ? "#059669" : "#DC2626" }}>
                      {insights.profitability.gross_profit != null ? `${currency} ${Number(insights.profitability.gross_profit).toLocaleString(undefined, { maximumFractionDigits: 0 })}` : "—"}
                    </div>
                  </div>
                  <div style={{ padding: "14px 16px", background: "var(--q-surface-2)", borderRadius: 10 }}>
                    <div style={{ fontSize: "0.72rem", color: "var(--q-text-4)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>Gross Margin</div>
                    <div style={{ fontSize: "1.25rem", fontWeight: 800 }}>{insights.profitability.gross_margin_pct != null ? `${Number(insights.profitability.gross_margin_pct).toFixed(2)}%` : "—"}</div>
                  </div>
                  {(insights.profitability.profit_by_category || []).length > 0 && (
                    <div style={{ gridColumn: "1 / -1" }}>
                      <div style={{ fontSize: "0.78rem", color: "var(--q-text-4)", fontWeight: 600, marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.05em" }}>Profit by Category</div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                        {insights.profitability.profit_by_category.slice(0, 6).map((c) => (
                          <div key={c.category} style={{ display: "flex", justifyContent: "space-between", padding: "8px 12px", background: "var(--q-surface-2)", borderRadius: 8, fontSize: "0.85rem" }}>
                            <span style={{ fontWeight: 600 }}>{c.category}</span>
                            <span style={{ fontWeight: 700, color: (c.profit ?? 0) >= 0 ? "#059669" : "#DC2626" }}>
                              {currency} {Number(c.profit ?? 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="q-empty" style={{ padding: "20px 0", textAlign: "center" }}>
                  <div style={{ fontSize: "0.85rem", color: "var(--q-text-4)" }}>No profit or cost columns found in the dataset — add Gross Profit or Cost columns to enable profitability analysis.</div>
                </div>
              )}
            </Section>
          )}

          {/* Risks / Opportunities / Recommendations */}
          {((insights.risks || []).length + (insights.opportunities || []).length + (insights.recommendations || []).length) > 0 && (
            <Section title="Risks, Opportunities & AI Recommendations" sub="Rule-based signals derived from your actual metrics — Module 10">
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 16 }}>
                <div>
                  <div style={{ fontSize: "0.8rem", fontWeight: 700, color: "#DC2626", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.05em" }}>Risks ({(insights.risks || []).length})</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {(insights.risks || []).length === 0 && <div style={{ fontSize: "0.82rem", color: "var(--q-text-4)" }}>No risks detected.</div>}
                    {(insights.risks || []).map((r, i) => (
                      <div key={i} style={{ padding: "10px 12px", background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 8 }}>
                        <div style={{ fontSize: "0.82rem", fontWeight: 700, color: "#DC2626", marginBottom: 3 }}>{r.title}</div>
                        <div style={{ fontSize: "0.78rem", color: "var(--q-text-3)", lineHeight: 1.5 }}>{r.detail}</div>
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: "0.8rem", fontWeight: 700, color: "#059669", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.05em" }}>Opportunities ({(insights.opportunities || []).length})</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {(insights.opportunities || []).length === 0 && <div style={{ fontSize: "0.82rem", color: "var(--q-text-4)" }}>No opportunities flagged.</div>}
                    {(insights.opportunities || []).map((o, i) => (
                      <div key={i} style={{ padding: "10px 12px", background: "#ECFDF5", border: "1px solid #A7F3D0", borderRadius: 8 }}>
                        <div style={{ fontSize: "0.82rem", fontWeight: 700, color: "#059669", marginBottom: 3 }}>{o.title}</div>
                        <div style={{ fontSize: "0.78rem", color: "var(--q-text-3)", lineHeight: 1.5 }}>{o.detail}</div>
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: "0.8rem", fontWeight: 700, color: "#2563EB", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.05em", display: "flex", alignItems: "center", gap: 6 }}>
                    <Lightbulb size={13} /> Recommendations ({(insights.recommendations || []).length})
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {(insights.recommendations || []).length === 0 && <div style={{ fontSize: "0.82rem", color: "var(--q-text-4)" }}>No recommendations.</div>}
                    {(insights.recommendations || []).map((rec, i) => (
                      <div key={i} style={{ padding: "10px 12px", background: "#EFF6FF", border: "1px solid #BFDBFE", borderRadius: 8 }}>
                        <div style={{ fontSize: "0.82rem", fontWeight: 700, color: "#2563EB", marginBottom: 3 }}>{rec.title}</div>
                        <div style={{ fontSize: "0.78rem", color: "var(--q-text-3)", lineHeight: 1.5 }}>{rec.detail}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </Section>
          )}

          {/* Anomaly summary (Module 5) */}
          {anomaly.total_records > 0 && (
            <Section title="Anomaly Detection Summary" sub="Isolation Forest — Module 5 · scikit-learn">
              <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: 32, alignItems: "center" }}>
                <ResponsiveContainer width={180} height={180}>
                  <PieChart>
                    <Pie data={anomalyPieData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={3} dataKey="value">
                      {anomalyPieData.map((_, i) => (
                        <Cell key={i} fill={i === 0 ? "#059669" : "#DC2626"} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v, n) => [v.toLocaleString(), n]} contentStyle={{ borderRadius: 8, border: "1px solid var(--q-border)" }} />
                  </PieChart>
                </ResponsiveContainer>
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {[
                    { label: "Total Records", value: (anomaly.total_records || 0).toLocaleString(), color: "var(--q-text-1)" },
                    { label: "Normal Records", value: (anomaly.normal_records || 0).toLocaleString(), color: "#059669" },
                    { label: "Anomalous Records", value: (anomaly.anomaly_count || 0).toLocaleString(), color: "#DC2626" },
                    { label: "Anomaly Rate", value: `${anomaly.anomaly_percentage ?? 0}%`, color: "#D97706" },
                  ].map(({ label, value, color }) => (
                    <div key={label} style={{ display: "flex", justifyContent: "space-between", padding: "10px 14px", background: "var(--q-surface-2)", borderRadius: 8 }}>
                      <span style={{ fontSize: "0.875rem", color: "var(--q-text-3)" }}>{label}</span>
                      <span style={{ fontWeight: 700, color }}>{value}</span>
                    </div>
                  ))}
                </div>
              </div>
              {anomalyRecords.length > 0 && (
                <div style={{ marginTop: 20 }}>
                  <div style={{ fontSize: "0.78rem", fontWeight: 700, color: "var(--q-text-4)", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                    Detected Anomalies ({anomalyRecords.length}{anomaly.total_records ? ` of ${anomaly.anomaly_count ?? anomaly.anomalies_detected ?? ""}` : ""})
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 260, overflowY: "auto" }}>
                    {anomalyRecords.slice(0, 25).map((r, i) => (
                      <div key={i} style={{ display: "flex", gap: 12, padding: "8px 12px", background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 8, fontSize: "0.8rem", alignItems: "center" }}>
                        <span style={{ fontWeight: 700, color: "#DC2626", minWidth: 90 }}>{r.date || "—"}</span>
                        <span style={{ fontWeight: 600, minWidth: 110 }}>{r.id || "—"}</span>
                        <span style={{ color: "var(--q-text-3)", flex: 1 }}>{r.reason}</span>
                        {r.sales != null && <span style={{ fontWeight: 700 }}>{currency} {Number(r.sales).toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </Section>
          )}

          {/* Data quality report (Module 2) */}
          {Object.keys(cleaning).length > 0 && (
            <Section title="Data Quality Report" sub="Output from Module 2 · Cleaning Pipeline">
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(220px,1fr))", gap: 12 }}>
                {[
                  { label: "Outlier Treatment", value: cleaning.outlier_treatment || "—" },
                  { label: "Invalid Dates (post-clean)", value: cleaning.consistency?.invalid_dates ?? "—" },
                  { label: "Remaining Missing Values", value: cleaning.missing_values ? Object.values(cleaning.missing_values).reduce((a, b) => a + Number(b || 0), 0) : "—" },
                  { label: "Remaining Duplicates", value: cleaning.duplicate_rows ?? "—" },
                  { label: "Outlier Count", value: cleaning.outliers?.outlier_count ?? "—" },
                ].map(({ label, value }) => (
                  <div key={label} style={{ padding: "12px 14px", background: "var(--q-surface-2)", borderRadius: 10 }}>
                    <div style={{ fontSize: "0.75rem", color: "var(--q-text-4)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>{label}</div>
                    <div style={{ fontWeight: 700, fontSize: "1rem", color: "var(--q-text-1)" }}>{String(value)}</div>
                  </div>
                ))}
              </div>
            </Section>
          )}
        </>
      )}
    </div>
  );
}
