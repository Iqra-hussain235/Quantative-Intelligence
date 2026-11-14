"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useBusiness, NOVAMART_METRICS } from "@/context/BusinessContext";
import {
  TrendingUp, TrendingDown, AlertTriangle, Target,
  ArrowRight, Bot, Shuffle, Users, Activity, DollarSign,
  UserX, ChevronRight, Zap, Plus, BarChart3, Upload,
  Clock, Award, Lightbulb, ShoppingBag, Receipt, UserCheck, RefreshCw, Building2,
} from "lucide-react";
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import { useState } from "react";

// ── Reusable: No-data empty state card ───────────────────────────────────────
function EmptyCard({ icon, title, desc, action, onAction }) {
  return (
    <div style={{ padding: "40px 24px", textAlign: "center", background: "var(--q-surface)", border: "1px solid var(--q-border)", borderRadius: 14, display: "flex", flexDirection: "column", alignItems: "center" }}>
      <div style={{ fontSize: "2rem", marginBottom: 12, opacity: 0.35 }}>{icon}</div>
      <div style={{ fontWeight: 600, fontSize: "0.9375rem", color: "var(--q-text-1)", marginBottom: 6 }}>{title}</div>
      <div style={{ fontSize: "0.875rem", color: "var(--q-text-3)", maxWidth: 280, lineHeight: 1.6, marginBottom: action ? 18 : 0 }}>{desc}</div>
      {action && (
        <button onClick={onAction} className="q-btn q-btn-primary q-btn-sm" style={{ gap: 6 }}>
          <Plus size={14} /> {action}
        </button>
      )}
    </div>
  );
}

// ── KPI Card ──────────────────────────────────────────────────────────────────
function KPICard({ label, value, delta, up, sub, icon: Icon, color, noData }) {
  return (
    <div className="q-kpi-card" style={{ cursor: "default" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <span className="q-kpi-label">{label}</span>
        <div style={{ width: 34, height: 34, borderRadius: 8, background: color + "15", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Icon size={16} style={{ color }} />
        </div>
      </div>
      {noData ? (
        <>
          <div style={{ fontSize: "1.5rem", fontWeight: 700, color: "var(--q-text-4)" }}>—</div>
          <div style={{ fontSize: "0.8125rem", color: "var(--q-text-4)", marginTop: 8 }}>No data yet</div>
        </>
      ) : (
        <>
          <div className="q-kpi-value">{value}</div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 8 }}>
            {delta && <span className={up ? "q-delta-up" : "q-delta-down"}>{up ? "▲" : "▼"} {delta}</span>}
            {sub && <span className="q-kpi-sub">{sub}</span>}
          </div>
        </>
      )}
    </div>
  );
}

// ── Health Score ring ─────────────────────────────────────────────────────────
function HealthScore({ score, breakdown }) {
  if (!score) {
    return (
      <div className="q-card" style={{ padding: 24 }}>
        <h3 style={{ fontWeight: 700, fontSize: "1rem", marginBottom: 16 }}>Business Health Score</h3>
        <div className="q-empty" style={{ padding: "32px 0" }}>
          <div style={{ fontSize: "2rem", marginBottom: 10, opacity: 0.3 }}>📊</div>
          <div style={{ fontWeight: 600, color: "var(--q-text-3)" }}>Insufficient data</div>
          <div style={{ fontSize: "0.875rem", color: "var(--q-text-4)", marginTop: 6 }}>Upload or enter business data to generate a health score.</div>
        </div>
      </div>
    );
  }

  const circumference = 2 * Math.PI * 52;
  const progress = (score / 100) * circumference;

  return (
    <div className="q-card" style={{ padding: 24 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 }}>
        <div>
          <h3 style={{ fontWeight: 700, fontSize: "1rem", marginBottom: 4 }}>Business Health Score</h3>
          <p style={{ fontSize: "0.875rem", color: "var(--q-text-3)" }}>Based on your actual data</p>
        </div>
        <span className={`q-badge ${score >= 70 ? "q-badge-success" : score >= 50 ? "q-badge-warning" : "q-badge-danger"}`}>
          {score >= 70 ? "Healthy" : score >= 50 ? "Needs Work" : "At Risk"}
        </span>
      </div>
      <div style={{ display: "flex", gap: 28, alignItems: "center" }}>
        <div style={{ position: "relative", flexShrink: 0 }}>
          <svg width={124} height={124} viewBox="0 0 124 124">
            <circle cx={62} cy={62} r={52} fill="none" stroke="var(--q-surface-3)" strokeWidth={10} />
            <circle cx={62} cy={62} r={52} fill="none" stroke="#2563EB" strokeWidth={10}
              strokeDasharray={`${progress} ${circumference - progress}`}
              strokeLinecap="round" transform="rotate(-90 62 62)" />
          </svg>
          <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
            <span style={{ fontSize: "1.875rem", fontWeight: 800, color: "var(--q-text-1)", lineHeight: 1 }}>{score}</span>
            <span style={{ fontSize: "0.75rem", color: "var(--q-text-4)", marginTop: 2 }}>/ 100</span>
          </div>
        </div>
        {breakdown && (
          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 10 }}>
            {breakdown.map(({ label, score: s, bar }) => (
              <div key={label}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                  <span style={{ fontSize: "0.8125rem", color: "var(--q-text-3)" }}>{label}</span>
                  <span style={{ fontSize: "0.8125rem", fontWeight: 600 }}>{s}</span>
                </div>
                <div className="q-progress-track" style={{ height: 4 }}>
                  <div style={{ height: "100%", width: `${s}%`, background: bar, borderRadius: 2 }} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Demo banner ───────────────────────────────────────────────────────────────
function DemoBanner({ onExit }) {
  return (
    <div style={{ padding: "12px 20px", background: "linear-gradient(135deg,#1e3a8a,#2563eb)", borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24, gap: 12 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ fontSize: "1.125rem" }}>🎮</span>
        <span style={{ color: "#fff", fontSize: "0.9375rem", fontWeight: 600 }}>Demo Mode — You're viewing NovaMart sample data.</span>
      </div>
      <button onClick={onExit} style={{ background: "rgba(255,255,255,0.15)", border: "1px solid rgba(255,255,255,0.3)", color: "#fff", padding: "6px 16px", borderRadius: 8, cursor: "pointer", fontSize: "0.875rem", fontWeight: 600, fontFamily: "inherit", whiteSpace: "nowrap" }}>
        Use My Data →
      </button>
    </div>
  );
}

// ── Main Dashboard ────────────────────────────────────────────────────────────
export default function Dashboard() {
  const router = useRouter();
  const { isDemo, selected, metrics, loading, businessName, exitDemoMode, hasData, hasMLData, mlAnalytics } = useBusiness();
  const [activeChart, setActiveChart] = useState("revenue");

  const now = new Date();
  const hour = now.getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  // ── No business selected yet ──────────────────────────────────────────────
  if (!selected && !loading) {
    return (
      <div className="q-page-shell">
        <div style={{ maxWidth: 600, margin: "60px auto", textAlign: "center" }}>
          <div style={{ fontSize: "3rem", marginBottom: 20 }}>👋</div>
          <h1 style={{ fontWeight: 800, fontSize: "1.75rem", marginBottom: 12 }}>Welcome to Quantora</h1>
          <p style={{ color: "var(--q-text-3)", fontSize: "1.0625rem", lineHeight: 1.7, marginBottom: 32 }}>
            To get started, add your restaurant or cafe and upload your sales data.
          </p>
          <div style={{ display: "flex", gap: 14, justifyContent: "center", flexWrap: "wrap" }}>
            <button onClick={() => router.push("/businesses/new")} className="q-btn q-btn-primary q-btn-lg" style={{ gap: 8 }}>
              <Plus size={18} /> Set Up My Business
            </button>
            <button onClick={() => router.push("/businesses")} className="q-btn q-btn-outline q-btn-lg" style={{ gap: 8 }}>
              <Building2 size={18} /> My Businesses
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Loading ──────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="q-page-shell">
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: 400, gap: 16 }}>
          <div className="q-spinner" style={{ width: 36, height: 36, borderWidth: 3 }} />
          <p style={{ color: "var(--q-text-3)" }}>Loading dashboard for {businessName}...</p>
        </div>
      </div>
    );
  }

  // ── Resolve data source ────────────────────────────────────────────────────
  // Demo → NovaMart metrics. Real business → DB metrics (/metrics) merged with
  // ML pipeline results (/ml-analytics). ML KPIs fill gaps when transactional
  // tables are empty (e.g. business only has an uploaded dataset).
  const m = isDemo ? NOVAMART_METRICS : metrics;
  const hasDbMetrics =
    !isDemo && m && !m._empty &&
    (m.revenue != null || m.customers != null || m.healthScore != null);

  const mlResults = mlAnalytics?.mlResults;
  const mlKpis = mlAnalytics?.kpis || {};
  const insights = mlResults?.insights || {};
  const hasInsights = hasMLData && insights && !insights.error;

  const mlDerived = hasMLData ? {
    revenue: mlKpis.total_revenue ?? null,
    netProfit: insights?.profitability?.total_profit ?? null,
    profit: insights?.profitability?.total_profit ?? null,
    customers: insights?.customer_analytics?.identified_customers ?? mlKpis.customer_count ?? null,
    churnRate: null,
    healthScore: null,
    revenueChart: (insights?.demand_forecast?.history || []).map((h) => ({
      month: h.period ?? h.month,
      revenue: h.actual ?? 0,
      profit: null,
    })),
    customerChart: null,
    alerts: mlResults?.alerts || [],
  } : null;

  const eff = hasDbMetrics ? m : (isDemo ? m : mlDerived);
  const noData = !eff;
  const currency = selected?.currency || "USD";

  // Build KPI list — always show the cards, show "—" when no data
  const fmt = (v) => v == null ? "—" : v >= 100000 ? `₹${(v / 100000).toFixed(1)}L` : v >= 1000 ? `₹${(v / 1000).toFixed(0)}K` : `₹${Math.round(v)}`;
  const KPIs = [
    { label: "Revenue", value: eff ? fmt(eff.revenue ?? 0) : "—", delta: eff?.revenueDelta, up: true, sub: "vs last period", icon: DollarSign, color: "#2563EB" },
    { label: "Net Profit", value: eff ? fmt(eff.netProfit ?? eff.profit ?? 0) : "—", delta: eff?.profitDelta, up: true, sub: "", icon: TrendingUp, color: "#059669" },
    { label: "Customers", value: eff ? (eff.customers ?? 0).toLocaleString() : "—", delta: eff?.customersDelta, up: true, sub: "total active", icon: Users, color: "#7C3AED" },
    { label: "Churn Rate", value: eff?.churnRate != null ? `${eff.churnRate}%` : "—", delta: undefined, up: false, sub: "monthly", icon: UserX, color: "#DC2626" },
    { label: "Health Score", value: eff?.healthScore != null ? `${eff.healthScore}/100` : "—", delta: undefined, up: true, sub: eff?.healthScore ? "AI-calculated" : "", icon: Activity, color: "#D97706" },
    ...(hasInsights ? [
      { label: "Total Orders", value: insights?.orders?.total_orders != null ? Number(insights.orders.total_orders).toLocaleString() : "—", icon: ShoppingBag, color: "#0891B2" },
      { label: "Avg Order Value", value: insights?.orders?.avg_order_value != null ? fmt(insights.orders.avg_order_value) : "—", icon: Receipt, color: "#D97706" },
      { label: "Profit Margin", value: (mlKpis.profit_margin ?? insights?.profitability?.gross_margin_pct) != null ? `${Number(mlKpis.profit_margin ?? insights?.profitability?.gross_margin_pct).toFixed(1)}%` : "—", icon: TrendingUp, color: "#059669" },
    ] : []),
  ];

  // Normalize alerts from any source into {severity, title, body}
  const rawAlerts = isDemo ? NOVAMART_METRICS.alerts : (eff?.alerts || mlResults?.alerts || []);
  const alerts = (rawAlerts || []).map((a, i) => ({
    id: i + 1,
    severity: a.severity === "info" ? "low" : (a.severity === "warning" || a.severity === "high" || a.severity === "danger" ? "high" : "medium"),
    title: a.title || (a.type === "anomaly" ? "Anomaly Detected" : a.type === "status" ? "Status" : "Alert"),
    body: a.body || a.message || "",
  })).filter((a) => !(a.severity === "low" && /no anomaly alert/i.test(a.body)));

  return (
    <div className="q-page-shell-full">
      {isDemo && <DemoBanner onExit={() => { exitDemoMode(); router.push("/businesses"); }} />}

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12, marginBottom: 28 }} className="q-fade-in">
        <div>
          <h1 style={{ fontSize: "1.625rem", fontWeight: 700, color: "var(--q-text-1)", marginBottom: 6 }}>
            {greeting} 👋
          </h1>
          <p style={{ color: "var(--q-text-3)", fontSize: "0.9375rem" }}>
            {businessName ? `${businessName}` : "Your workspace"}{noData && !isDemo ? " · Add data to see insights" : " · Last 30 days"}
          </p>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button className="q-btn q-btn-outline q-btn-sm" onClick={() => router.push("/ai-doctor")} style={{ gap: 6 }}>
            <Bot size={15} /> Ask AI Doctor
          </button>
          <button className="q-btn q-btn-primary q-btn-sm" onClick={() => router.push("/simulator")} style={{ gap: 6 }}>
            <Shuffle size={15} /> Simulate
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="q-kpi-grid" style={{ marginBottom: 28 }}>
        {KPIs.map((k, i) => (
          <div key={k.label} className={`q-fade-in-${Math.min(i + 1, 5)}`}>
            <KPICard {...k} noData={noData} />
          </div>
        ))}
      </div>

      {/* Health Score + Brief */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 28 }}>
        <HealthScore score={eff?.healthScore} breakdown={eff?.breakdown} />

        {/* Brief */}
        <div className="q-card" style={{ padding: 24 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: "#FEF3C7", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Zap size={16} color="#D97706" />
            </div>
            <h3 style={{ fontWeight: 700, fontSize: "1rem" }}>Today's Business Brief</h3>
          </div>

          {noData ? (
            <div className="q-empty" style={{ padding: "28px 0" }}>
              <div style={{ fontSize: "1.5rem", opacity: 0.3, marginBottom: 10 }}>📋</div>
              <div style={{ fontWeight: 600, color: "var(--q-text-3)" }}>No data yet</div>
              <div style={{ fontSize: "0.875rem", color: "var(--q-text-4)", marginTop: 6, maxWidth: 240 }}>
                Upload a CSV/Excel file or enter metrics manually to see your daily brief.
              </div>
              <button onClick={() => router.push("/analytics")} className="q-btn q-btn-blue q-btn-sm" style={{ marginTop: 14, gap: 5 }}>
                <Plus size={13} /> Add Business Data
              </button>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {[
                { label: "Overall Health", value: eff.healthScore != null ? `${eff.healthScore} — ${eff.healthScore >= 70 ? "Healthy" : "Needs Work"}` : "—", icon: eff.healthScore >= 70 ? "✅" : "⚠️" },
                { label: "Revenue", value: eff.revenue != null ? fmt(eff.revenue) : "—", icon: "📈" },
                { label: "Customers", value: (eff.customers ?? 0).toLocaleString(), icon: "👥" },
                { label: "Churn Rate", value: eff.churnRate != null ? `${eff.churnRate}%` : "—", icon: "📉" },
              ].map(({ label, value, icon }) => (

                <div key={label} style={{ display: "flex", gap: 12, padding: "12px 14px", background: "var(--q-surface-2)", borderRadius: 10 }}>
                  <span style={{ fontSize: "1rem", flexShrink: 0 }}>{icon}</span>
                  <div>
                    <div style={{ fontSize: "0.72rem", color: "var(--q-text-4)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 3 }}>{label}</div>
                    <div style={{ fontSize: "0.875rem", color: "var(--q-text-1)", fontWeight: 500 }}>{value}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Alerts */}
      {alerts.length > 0 && (
        <div style={{ marginBottom: 28 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
            <AlertTriangle size={18} color="#DC2626" />
            <h2 style={{ fontSize: "1.125rem", fontWeight: 700 }}>Needs Your Attention</h2>
            <span className="q-badge q-badge-danger">{alerts.length}</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {alerts.map((alert) => (
              <div key={alert.id} style={{ padding: "16px 20px", background: alert.severity === "high" ? "#FEF2F2" : "#FFFBEB", border: `1px solid ${alert.severity === "high" ? "#FECACA" : "#FDE68A"}`, borderRadius: 12, display: "flex", gap: 14 }}>
                <AlertTriangle size={18} style={{ color: alert.severity === "high" ? "#DC2626" : "#D97706", flexShrink: 0, marginTop: 2 }} />
                <div>
                  <div style={{ fontWeight: 600, fontSize: "0.9375rem", marginBottom: 4 }}>{alert.title}</div>
                  <p style={{ fontSize: "0.875rem", color: "var(--q-text-3)", lineHeight: 1.6 }}>{alert.body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Chart */}
      {eff?.revenueChart && (
        <div style={{ marginBottom: 28 }}>
          <div className="q-card">
            <div style={{ padding: "20px 24px", borderBottom: "1px solid var(--q-border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <h3 style={{ fontWeight: 700, fontSize: "1rem" }}>Performance Trend</h3>
                <p style={{ fontSize: "0.8125rem", color: "var(--q-text-3)", marginTop: 3 }}>Revenue and profit over time</p>
              </div>
              <div style={{ display: "flex", gap: 4 }}>
                {["revenue", "customers"].map(t => (
                  <button key={t} className={`q-tab q-btn-sm${activeChart === t ? " active" : ""}`} onClick={() => setActiveChart(t)} style={{ padding: "5px 12px", fontSize: "0.8125rem", border: "none", background: activeChart === t ? "var(--q-blue-subtle)" : "none", color: activeChart === t ? "var(--q-blue)" : "var(--q-text-3)", borderRadius: 6, cursor: "pointer", fontFamily: "inherit", fontWeight: 500 }}>
                    {t === "revenue" ? "Revenue" : "Customers"}
                  </button>
                ))}
              </div>
            </div>
            <div style={{ padding: "20px 24px" }}>
              <ResponsiveContainer width="100%" height={220}>
                {activeChart === "revenue" ? (
                  <AreaChart data={eff.revenueChart}>
                    <defs>
                      <linearGradient id="revG" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#2563EB" stopOpacity={0.15} />
                        <stop offset="95%" stopColor="#2563EB" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="profG" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#059669" stopOpacity={0.15} />
                        <stop offset="95%" stopColor="#059669" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--q-border)" vertical={false} />
                    <XAxis dataKey="month" tick={{ fontSize: 12, fill: "var(--q-text-4)" }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 12, fill: "var(--q-text-4)" }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid var(--q-border)" }} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Area type="monotone" dataKey="revenue" name="Revenue" stroke="#2563EB" strokeWidth={2} fill="url(#revG)" />
                    <Area type="monotone" dataKey="profit" name="Profit" stroke="#059669" strokeWidth={2} fill="url(#profG)" />
                  </AreaChart>
                ) : (
                  <BarChart data={eff.customerChart || []}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--q-border)" vertical={false} />
                    <XAxis dataKey="month" tick={{ fontSize: 12, fill: "var(--q-text-4)" }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 12, fill: "var(--q-text-4)" }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid var(--q-border)" }} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Bar dataKey="new" name="New" fill="#2563EB" radius={[3, 3, 0, 0]} />
                    <Bar dataKey="returning" name="Returning" fill="#7C3AED" radius={[3, 3, 0, 0]} />
                    <Bar dataKey="churned" name="Churned" fill="#DC2626" radius={[3, 3, 0, 0]} />
                  </BarChart>
                )}
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {/* No chart data empty state */}
      {!eff?.revenueChart && !noData && (
        <EmptyCard icon="📈" title="No chart data yet" desc="Upload your sales or revenue data to see trend charts." action="Upload Data" onAction={() => router.push("/analytics")} />
      )}

      {/* Full empty state */}
      {noData && (
        <div style={{ marginBottom: 28 }}>
          <EmptyCard
            icon="📂"
            title="No business data yet"
            desc="Upload a CSV/Excel file with your sales, revenue, or customer data to unlock insights, AI analysis, risk detection, and recommendations."
            action="Upload Data Now"
            onAction={() => router.push("/analytics")}
          />
        </div>
      )}

      {/* ML Analytics CTA / Summary */}
      {!isDemo && (
        <div style={{ marginBottom: 28 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14, flexWrap: "wrap", gap: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <BarChart3 size={18} color="#059669" />
              <h2 style={{ fontSize: "1.125rem", fontWeight: 700 }}>ML Analytics</h2>
              {hasMLData && <span className="q-badge q-badge-success">Live Data</span>}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              {mlAnalytics?.processedAt && (
                <span style={{ fontSize: "0.75rem", color: "var(--q-text-4)", display: "flex", alignItems: "center", gap: 5 }}>
                  <Clock size={12} /> Last analyzed {new Date(mlAnalytics.processedAt).toLocaleString()}
                </span>
              )}
              <button className="q-btn q-btn-ghost q-btn-sm" style={{ gap: 4 }} onClick={() => router.push("/analytics/ml")}>
                {hasMLData ? "View Full Analytics" : "Upload Dataset"} <ChevronRight size={14} />
              </button>
            </div>
          </div>

          {hasMLData ? (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 14 }}>
              {[
                { label: "Total Revenue", value: mlKpis.total_revenue != null ? `${currency} ${Number(mlKpis.total_revenue).toLocaleString(undefined, { maximumFractionDigits: 0 })}` : "—", color: "#2563EB" },
                { label: "Total Orders", value: insights?.orders?.total_orders != null ? Number(insights.orders.total_orders).toLocaleString() : "—", color: "#0891B2" },
                { label: "Customers", value: mlKpis.customer_count != null ? mlKpis.customer_count.toLocaleString() : "—", color: "#7C3AED" },
                { label: "Profit Margin", value: mlKpis.profit_margin != null ? `${Number(mlKpis.profit_margin).toFixed(2)}%` : "—", color: "#059669" },
                { label: "Avg Order Value", value: mlKpis.average_order_value != null ? `${currency} ${Number(mlKpis.average_order_value).toFixed(0)}` : "—", color: "#D97706" },
                { label: "Anomaly %", value: mlKpis.anomaly_percentage != null ? `${Number(mlKpis.anomaly_percentage).toFixed(1)}%` : "—", color: "#DC2626" },
              ].map(({ label, value, color }) => (
                <div key={label} style={{ padding: "14px 16px", background: "var(--q-surface)", border: "1px solid var(--q-border)", borderRadius: 12 }}>
                  <div style={{ fontSize: "0.75rem", color: "var(--q-text-4)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>{label}</div>
                  <div style={{ fontSize: "1.25rem", fontWeight: 700, color }}>{value}</div>
                  <div style={{ fontSize: "0.75rem", color: "var(--q-text-4)", marginTop: 4 }}>ML Pipeline</div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ padding: "24px 20px", background: "var(--q-surface)", border: "1px solid var(--q-border)", borderRadius: 14, display: "flex", gap: 16, alignItems: "center" }}>
              <div style={{ width: 44, height: 44, borderRadius: 10, background: "#ECFDF5", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <BarChart3 size={20} color="#059669" />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, marginBottom: 4 }}>Run ML Analytics on your data</div>
                <div style={{ fontSize: "0.875rem", color: "var(--q-text-3)" }}>
                  Upload a CSV/Excel dataset to generate KPIs, trend analysis, anomaly detection, and alerts using Modules 1–9.
                </div>
              </div>
              <button onClick={() => router.push("/analytics/ml")} className="q-btn q-btn-primary q-btn-sm" style={{ gap: 6, whiteSpace: "nowrap" }}>
                Upload Dataset <ArrowRight size={14} />
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── ML Insights (Modules 1–10 pipeline output) ─────────────────────── */}
      {!isDemo && hasInsights && (
        <div style={{ marginBottom: 28 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
            <Lightbulb size={18} color="#7C3AED" />
            <h2 style={{ fontSize: "1.125rem", fontWeight: 700 }}>ML Insights</h2>
            <span className="q-badge q-badge-neutral">Generated from your data</span>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 20 }}>

            {/* Best-selling items */}
            {(insights.best_selling_items || []).length > 0 && (
              <div className="q-card" style={{ padding: 20 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
                  <Award size={16} color="#D97706" />
                  <h3 style={{ fontWeight: 700, fontSize: "0.9375rem" }}>Best-Selling Items</h3>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {insights.best_selling_items.slice(0, 5).map((item, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", background: "var(--q-surface-2)", borderRadius: 8 }}>
                      <span style={{ width: 22, height: 22, borderRadius: 6, background: "#FEF3C7", color: "#D97706", fontSize: "0.72rem", fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{i + 1}</span>
                      <span style={{ flex: 1, fontSize: "0.85rem", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.product}{item.sku ? <span style={{ color: "var(--q-text-4)", fontWeight: 400, fontSize: "0.75rem" }}> · {item.sku}</span> : null}</span>
                      <span style={{ fontSize: "0.78rem", color: "var(--q-text-4)" }}>{item.orders} orders{item.quantity != null ? ` · ${item.quantity} qty` : ""}</span>
                      <span style={{ fontSize: "0.85rem", fontWeight: 700 }}>{currency} {Number(item.sales).toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Peak hours */}
            {(insights.peak_hours?.hourly || []).length > 0 && (
              <div className="q-card" style={{ padding: 20 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                  <Clock size={16} color="#DC2626" />
                  <h3 style={{ fontWeight: 700, fontSize: "0.9375rem" }}>Peak Business Hours</h3>
                </div>
                {insights.peak_hours.peak_label && (
                  <div style={{ fontSize: "0.8rem", color: "var(--q-text-3)", marginBottom: 10 }}>
                    Busiest window: <strong>{insights.peak_hours.peak_label}</strong> ({insights.peak_hours.peak_orders} orders)
                  </div>
                )}
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={insights.peak_hours.hourly}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--q-border)" vertical={false} />
                    <XAxis dataKey="label" tick={{ fontSize: 10, fill: "var(--q-text-4)" }} axisLine={false} tickLine={false} interval={2} />
                    <YAxis tick={{ fontSize: 11, fill: "var(--q-text-4)" }} axisLine={false} tickLine={false} width={40} />
                    <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid var(--q-border)" }} formatter={(v) => [v, "Orders"]} />
                    <Bar dataKey="orders" fill="#DC2626" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Customer analytics */}
            {insights.customer_analytics && (
              <div className="q-card" style={{ padding: 20 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
                  <UserCheck size={16} color="#7C3AED" />
                  <h3 style={{ fontWeight: 700, fontSize: "0.9375rem" }}>Customer Analytics</h3>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  {[
                    { label: "Identified Customers", value: (insights.customer_analytics.identified_customers ?? insights.customer_analytics.unique_customers)?.toLocaleString() ?? "—" },
                    { label: "Repeat Rate", value: insights.customer_analytics.repeat_customer_rate_pct != null ? `${insights.customer_analytics.repeat_customer_rate_pct}%` : "—" },
                    { label: "Avg Orders / Customer", value: insights.customer_analytics.avg_orders_per_customer ?? "—" },
                    { label: "Walk-in Orders", value: insights.customer_analytics.walk_in_orders != null ? Number(insights.customer_analytics.walk_in_orders).toLocaleString() : "—" },
                    { label: "Top Customer Spend", value: insights.customer_analytics.top_customers?.[0]?.total_sales != null ? `${currency} ${Number(insights.customer_analytics.top_customers[0].total_sales).toLocaleString(undefined, { maximumFractionDigits: 0 })}` : "—" },
                  ].map((s) => (
                    <div key={s.label} style={{ padding: "10px 12px", background: "var(--q-surface-2)", borderRadius: 8 }}>
                      <div style={{ fontSize: "0.68rem", color: "var(--q-text-4)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>{s.label}</div>
                      <div style={{ fontWeight: 700, fontSize: "0.95rem" }}>{s.value}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Demand forecast */}
            {insights.demand_forecast?.available && (
              <div className="q-card" style={{ padding: 20 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                  <TrendingUp size={16} color="#059669" />
                  <h3 style={{ fontWeight: 700, fontSize: "0.9375rem" }}>Demand Forecast</h3>
                </div>
                <div style={{ fontSize: "0.75rem", color: "var(--q-text-4)", marginBottom: 8 }}>
                  {insights.demand_forecast.frequency === "daily" ? `next ${insights.demand_forecast.horizon} days` : insights.demand_forecast.frequency === "weekly" ? `next ${insights.demand_forecast.horizon} weeks` : `next ${insights.demand_forecast.horizon} months`} · after {insights.demand_forecast.last_actual_period}
                </div>
                <ResponsiveContainer width="100%" height={180}>
                  <LineChart
                    data={[
                      ...(insights.demand_forecast.history || []).map((h) => ({ month: h.period ?? h.month, actual: h.actual, forecast: null })),
                      ...(insights.demand_forecast.forecast || []).map((f) => ({ month: f.period ?? f.month, actual: null, forecast: f.forecast })),
                    ]}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--q-border)" vertical={false} />
                    <XAxis dataKey="month" tick={{ fontSize: 10, fill: "var(--q-text-4)" }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: "var(--q-text-4)" }} axisLine={false} tickLine={false} width={55} tickFormatter={(v) => `${currency} ${(v / 1000).toFixed(0)}k`} />
                    <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid var(--q-border)" }} formatter={(v) => (v != null ? [`${currency} ${Number(v).toLocaleString(undefined, { maximumFractionDigits: 0 })}`] : ["—"])} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Line type="monotone" dataKey="actual" name="Actual" stroke="#2563EB" strokeWidth={2} dot={false} connectNulls />
                    <Line type="monotone" dataKey="forecast" name="Forecast" stroke="#059669" strokeWidth={2} strokeDasharray="6 4" dot={{ r: 3 }} connectNulls />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Risks / Opportunities / Recommendations */}
            {((insights.risks || []).length + (insights.opportunities || []).length + (insights.recommendations || []).length) > 0 && (
              <div className="q-card" style={{ padding: 20 }}>
                <h3 style={{ fontWeight: 700, fontSize: "0.9375rem", marginBottom: 14 }}>Risks, Opportunities &amp; Recommendations</h3>
                <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                  {(insights.risks || []).map((r, i) => (
                    <div key={`r${i}`} style={{ padding: "10px 12px", background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 8 }}>
                      <div style={{ fontSize: "0.78rem", fontWeight: 700, color: "#DC2626", marginBottom: 3 }}>⚠ {r.title}</div>
                      <div style={{ fontSize: "0.8rem", color: "var(--q-text-3)", lineHeight: 1.5 }}>{r.detail}</div>
                    </div>
                  ))}
                  {(insights.opportunities || []).map((o, i) => (
                    <div key={`o${i}`} style={{ padding: "10px 12px", background: "#ECFDF5", border: "1px solid #A7F3D0", borderRadius: 8 }}>
                      <div style={{ fontSize: "0.78rem", fontWeight: 700, color: "#059669", marginBottom: 3 }}>▲ {o.title}</div>
                      <div style={{ fontSize: "0.8rem", color: "var(--q-text-3)", lineHeight: 1.5 }}>{o.detail}</div>
                    </div>
                  ))}
                  {(insights.recommendations || []).map((rec, i) => (
                    <div key={`c${i}`} style={{ padding: "10px 12px", background: "#EFF6FF", border: "1px solid #BFDBFE", borderRadius: 8 }}>
                      <div style={{ fontSize: "0.78rem", fontWeight: 700, color: "#2563EB", marginBottom: 3 }}>💡 {rec.title}</div>
                      <div style={{ fontSize: "0.8rem", color: "var(--q-text-3)", lineHeight: 1.5 }}>{rec.detail}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Next Best Actions CTA */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Target size={18} color="#8B1A1A" />
            <h2 style={{ fontSize: "1.125rem", fontWeight: 700 }}>Next Best Actions</h2>
            {!noData && <span className="q-badge q-badge-accent">AI Ranked</span>}
          </div>
          <button className="q-btn q-btn-ghost q-btn-sm" style={{ gap: 4 }} onClick={() => router.push("/actions")}>
            All Actions <ChevronRight size={14} />
          </button>
        </div>
        {noData ? (
          <EmptyCard icon="🎯" title="No actions yet" desc="Actions are generated automatically once you upload business data and AI analyzes it." />
        ) : (
          <div style={{ padding: 20, background: "var(--q-surface)", border: "1px solid var(--q-border)", borderRadius: 14, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <Target size={20} color="#8B1A1A" />
              <div>
                <div style={{ fontWeight: 600, fontSize: "0.9375rem" }}>{eff?.actions?.length || 0} recommendations available</div>
                <div style={{ fontSize: "0.875rem", color: "var(--q-text-3)" }}>View all AI-ranked action recommendations</div>
              </div>
            </div>
            <button onClick={() => router.push("/actions")} className="q-btn q-btn-primary q-btn-sm" style={{ gap: 6 }}>
              View Actions <ArrowRight size={14} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
