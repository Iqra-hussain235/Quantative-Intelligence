"use client";
import { useRouter } from "next/navigation";
import { useBusiness } from "@/context/BusinessContext";
import { Bot, Plus, Stethoscope, ArrowRight, Info, Activity, AlertTriangle, Lightbulb, Sparkles } from "lucide-react";
import { useMemo } from "react";

function Metric({ label, value, sub, color = "#2563EB" }) {
  return (
    <div className="q-card" style={{ padding: "14px 16px" }}>
      <div style={{ fontSize: "0.7rem", color: "var(--q-text-4)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>{label}</div>
      <div style={{ fontWeight: 800, fontSize: "1.2rem", color }}>{value}</div>
      {sub && <div style={{ fontSize: "0.72rem", color: "var(--q-text-4)", marginTop: 3 }}>{sub}</div>}
    </div>
  );
}

export default function AIDoctorPage() {
  const router = useRouter();
  const { isDemo, hasMLData, mlAnalytics, selected } = useBusiness();

  const { kpis, insights, alerts, anomalies } = useMemo(() => {
    if (isDemo || !hasMLData) return { kpis: {}, insights: {}, alerts: [], anomalies: [] };
    const r = mlAnalytics?.mlResults || {};
    return {
      kpis: r.kpis || {},
      insights: r.insights || {},
      alerts: r.alerts || [],
      anomalies: r.anomaly_records || r.anomaly_summary?.records || [],
    };
  }, [isDemo, hasMLData, mlAnalytics]);

  const currency = selected?.currency || "USD";
  const fmt = (v) => v == null ? "—" : `${currency} ${Number(v).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;

  const recs = insights.recommendations || [];
  const risks = insights.risks || [];
  const opps = insights.opportunities || [];

  if (isDemo || !hasMLData) {
    return (
      <div className="q-page-shell">
        <h1 className="q-page-title">AI Business Doctor</h1>
        <div style={{ maxWidth: 520, margin: "60px auto", textAlign: "center" }}>
          <Stethoscope size={40} style={{ opacity: 0.25, marginBottom: 16 }} />
          <h2 style={{ fontWeight: 700, fontSize: "1.25rem", marginBottom: 10 }}>{isDemo ? "Demo mode" : "No analysis yet"}</h2>
          <p style={{ color: "var(--q-text-3)", lineHeight: 1.7, marginBottom: 24 }}>
            {isDemo
              ? "The AI Business Doctor explains your real metrics and recommends actions. Exit demo mode to use it."
              : "Upload your sales data and the ML pipeline will generate diagnoses and recommendations from your actual numbers."}
          </p>
          <button onClick={() => router.push(isDemo ? "/businesses" : "/businesses/new")} className="q-btn q-btn-primary q-btn-sm" style={{ gap: 6 }}>
            <Plus size={14} /> {isDemo ? "Exit Demo" : "Add Business / Upload Data"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="q-page-shell">
      <div className="q-page-header">
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Bot size={22} color="#8B1A1A" />
          <div>
            <h1 className="q-page-title">AI Business Doctor</h1>
            <p className="q-page-subtitle">
              {selected?.businessName} · diagnosis from your ML-processed data
              {mlAnalytics?.processedAt ? ` · last analysis ${new Date(mlAnalytics.processedAt).toLocaleString()}` : ""}
            </p>
          </div>
        </div>
      </div>

      {/* Health snapshot */}
      <div className="q-kpi-grid" style={{ marginBottom: 24 }}>
        <Metric label="Revenue" value={fmt(kpis.total_revenue)} sub="total sales" color="#2563EB" />
        <Metric label="Orders" value={(insights.orders?.total_orders ?? "—").toLocaleString?.() ?? insights.orders?.total_orders ?? "—"} sub={`AOV ${fmt(insights.orders?.avg_order_value)}`} color="#0891B2" />
        <Metric label="Gross Margin" value={insights.profitability?.gross_margin_pct != null ? `${Number(insights.profitability.gross_margin_pct).toFixed(1)}%` : "—"} sub="profit / revenue" color="#059669" />
        <Metric label="Customers" value={(insights.customer_analytics?.identified_customers ?? "—").toLocaleString?.() ?? "—"} sub={`${insights.customer_analytics?.walk_in_orders ?? 0} walk-in orders`} color="#7C3AED" />
        <Metric label="Anomaly Rate" value={mlAnalytics?.kpis?.anomaly_percentage != null ? `${mlAnalytics.kpis.anomaly_percentage}%` : "—"} sub={`${mlAnalytics?.kpis?.anomaly_count ?? 0} flagged orders`} color="#DC2626" />
      </div>

      {/* Diagnosis */}
      <div className="q-card" style={{ padding: 24, marginBottom: 24 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
          <Activity size={17} color="#8B1A1A" />
          <h3 style={{ fontWeight: 700, fontSize: "0.95rem" }}>Diagnosis</h3>
        </div>
        {risks.length === 0 && opps.length === 0 && recs.length === 0 ? (
          <p style={{ color: "var(--q-text-3)", fontSize: "0.87rem" }}>Not enough signals yet — upload more historical data for a deeper diagnosis.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {risks.slice(0, 3).map((r, i) => (
              <div key={`r${i}`} style={{ padding: "12px 14px", background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 10 }}>
                <div style={{ fontSize: "0.85rem", fontWeight: 700, color: "#DC2626", marginBottom: 4 }}>
                  <AlertTriangle size={13} style={{ display: "inline", marginRight: 6, verticalAlign: "-2px" }} />{r.title}
                </div>
                <div style={{ fontSize: "0.8rem", color: "var(--q-text-3)", lineHeight: 1.5 }}>{r.detail}</div>
              </div>
            ))}
            {opps.slice(0, 3).map((o, i) => (
              <div key={`o${i}`} style={{ padding: "12px 14px", background: "#ECFDF5", border: "1px solid #A7F3D0", borderRadius: 10 }}>
                <div style={{ fontSize: "0.85rem", fontWeight: 700, color: "#059669", marginBottom: 4 }}>
                  <TrendingUpIcon /> {o.title}
                </div>
                <div style={{ fontSize: "0.8rem", color: "var(--q-text-3)", lineHeight: 1.5 }}>{o.detail}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Prescriptions */}
      <div className="q-card" style={{ padding: 24, marginBottom: 24 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
          <Lightbulb size={17} color="#D97706" />
          <h3 style={{ fontWeight: 700, fontSize: "0.95rem" }}>Prescriptions (ranked by impact)</h3>
        </div>
        {recs.length === 0 ? (
          <p style={{ color: "var(--q-text-3)", fontSize: "0.87rem" }}>No recommendations generated yet.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {recs.map((r, i) => (
              <div key={i} style={{ display: "flex", gap: 12, padding: "12px 14px", background: "var(--q-surface-2)", borderRadius: 10, alignItems: "flex-start" }}>
                <span style={{ width: 24, height: 24, borderRadius: 6, background: "#2563EB", color: "#fff", fontSize: "0.72rem", fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{i + 1}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: "0.85rem", fontWeight: 700, marginBottom: 3 }}>{r.title}</div>
                  <div style={{ fontSize: "0.8rem", color: "var(--q-text-3)", lineHeight: 1.5 }}>{r.detail}</div>
                  {r.metric && <div style={{ fontSize: "0.7rem", color: "var(--q-text-4)", fontFamily: "monospace", marginTop: 4 }}>evidence: {r.metric}</div>}
                </div>
                <span className={`q-badge ${r.severity === "high" ? "q-badge-danger" : r.severity === "medium" ? "q-badge-warning" : "q-badge-neutral"}`}>{r.severity}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Alerts + anomalies */}
      {(alerts.length > 0 || anomalies.length > 0) && (
        <div className="q-card" style={{ padding: 24 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
            <Sparkles size={17} color="#2563EB" />
            <h3 style={{ fontWeight: 700, fontSize: "0.95rem" }}>Alerts &amp; Flagged Orders</h3>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: anomalies.length ? 16 : 0 }}>
            {alerts.map((a, i) => (
              <div key={i} style={{ padding: "10px 14px", background: a.severity === "warning" || a.severity === "high" ? "#FFFBEB" : "var(--q-surface-2)", border: `1px solid ${a.severity === "warning" || a.severity === "high" ? "#FDE68A" : "var(--q-border)"}`, borderRadius: 8, fontSize: "0.83rem" }}>
                {a.type === "anomaly" ? "⚠️" : "ℹ️"} {a.message}
              </div>
            ))}
          </div>
          {anomalies.length > 0 && (
            <div style={{ maxHeight: 220, overflowY: "auto" }}>
              {anomalies.slice(0, 20).map((a, i) => (
                <div key={i} style={{ display: "flex", gap: 10, padding: "7px 0", borderTop: "1px solid var(--q-border)", fontSize: "0.78rem" }}>
                  <span style={{ color: "#DC2626", fontWeight: 700, minWidth: 90 }}>{a.date || "—"}</span>
                  <span style={{ fontFamily: "monospace", minWidth: 110 }}>{a.id || "—"}</span>
                  <span style={{ color: "var(--q-text-3)", flex: 1 }}>{a.reason}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <p style={{ fontSize: "0.75rem", color: "var(--q-text-4)", marginTop: 16, display: "flex", alignItems: "center", gap: 6 }}>
        <Info size={12} /> All recommendations cite the metric that triggered them. Simulate impacts in the{" "}
        <button onClick={() => router.push("/simulator")} style={{ background: "none", border: "none", color: "#2563EB", cursor: "pointer", fontWeight: 600, fontFamily: "inherit", padding: 0 }}>Decision Simulator</button>.
      </p>
    </div>
  );
}

function TrendingUpIcon() {
  return <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ display: "inline", marginRight: 6, verticalAlign: "-2px", color: "#059669" }}><polyline points="23 6 13.5 15.5 8.5 10.5 1 18" /><polyline points="17 6 23 6 23 12" /></svg>;
}
