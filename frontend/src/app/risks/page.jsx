"use client";
import { useRouter } from "next/navigation";
import { useBusiness } from "@/context/BusinessContext";
import { AlertTriangle, ArrowRight, Plus, TrendingDown, Activity, Package, Info } from "lucide-react";
import { useMemo } from "react";

const SEV = {
  high: { dot: "#DC2626", bg: "#FEF2F2", border: "#FECACA", badge: "q-badge-danger", label: "High" },
  medium: { dot: "#D97706", bg: "#FFFBEB", border: "#FDE68A", badge: "q-badge-warning", label: "Medium" },
  low: { dot: "#059669", bg: "#ECFDF5", border: "#A7F3D0", badge: "q-badge-success", label: "Low" },
};

function RiskCard({ risk }) {
  const c = SEV[risk.severity] || SEV.medium;
  return (
    <div style={{ background: c.bg, border: `1px solid ${c.border}`, borderRadius: 14, padding: 20 }}>
      <div style={{ display: "flex", gap: 14 }}>
        <div style={{ width: 40, height: 40, borderRadius: 10, background: c.dot + "20", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <AlertTriangle size={18} style={{ color: c.dot }} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 8, marginBottom: 8 }}>
            <h3 style={{ fontWeight: 700, fontSize: "1rem" }}>{risk.title}</h3>
            <span className={`q-badge ${c.badge}`}>{c.label} severity</span>
          </div>
          {risk.detail && <p style={{ fontSize: "0.85rem", color: "var(--q-text-3)", lineHeight: 1.6, marginBottom: 8 }}>{risk.detail}</p>}
          {risk.metric && <div style={{ fontSize: "0.72rem", color: "var(--q-text-4)", fontFamily: "monospace" }}>metric: {risk.metric}</div>}
        </div>
      </div>
    </div>
  );
}

export default function RisksPage() {
  const router = useRouter();
  const { isDemo, hasMLData, mlAnalytics, selected } = useBusiness();

  const { risks, extras } = useMemo(() => {
    if (isDemo || !hasMLData) return { risks: [], extras: [] };
    const r = mlAnalytics?.mlResults || {};
    const insights = r.insights || {};
    const list = [...(insights.risks || [])];
    const extra = [];

    // Declining demand signal from the fitted trend (not just MoM)
    const fc = insights.demand_forecast || {};
    if (fc.available && (fc.period_growth_rate_pct ?? 0) < -2) {
      extra.push({
        severity: "medium",
        title: "Forecasted demand decline",
        detail: `The fitted ${fc.frequency} trend projects ${Math.abs(fc.period_growth_rate_pct).toFixed(1)}% ${fc.frequency} decline per period. Review pricing, menu and marketing.`,
        metric: "demand_forecast.period_growth_rate_pct",
      });
    }

    // Item-level demand decline
    for (const item of fc.item_demand_forecast || []) {
      const pts = item.forecast || [];
      if (pts.length >= 3) {
        const first = pts[0].forecast, last = pts[pts.length - 1].forecast;
        if (first > 0 && ((last - first) / first) < -0.15) {
          extra.push({
            severity: "low",
            title: `Declining demand: ${item.product}`,
            detail: `Forecast drops ~${Math.round((1 - last / first) * 100)}% across the horizon. Consider bundling, promotion or removing from menu.`,
            metric: "item_demand_forecast",
          });
        }
      }
    }

    // Anomaly-rate risk (synced with Module 5 summary)
    const an = r.anomaly_summary || {};
    if ((an.anomaly_percentage ?? 0) >= 3) {
      extra.push({
        severity: (an.anomaly_percentage ?? 0) >= 8 ? "high" : "medium",
        title: `${an.anomaly_count ?? "?"} anomalous orders detected`,
        detail: `${an.anomaly_percentage}% of orders deviate from normal patterns (${an.granularity || "order"}-level detection). Review the anomaly list in ML Analytics for dates and reasons.`,
        metric: "anomaly_percentage",
      });
    }

    return { risks: [...list, ...extra], extras: extra };
  }, [isDemo, hasMLData, mlAnalytics]);

  if (isDemo || !hasMLData) {
    return (
      <div className="q-page-shell">
        <h1 className="q-page-title">Risk Radar</h1>
        <div style={{ maxWidth: 520, margin: "60px auto", textAlign: "center" }}>
          <AlertTriangle size={40} style={{ opacity: 0.25, marginBottom: 16 }} />
          <h2 style={{ fontWeight: 700, fontSize: "1.25rem", marginBottom: 10 }}>
            {isDemo ? "Demo mode" : "No risk data yet"}
          </h2>
          <p style={{ color: "var(--q-text-3)", lineHeight: 1.7, marginBottom: 24 }}>
            {isDemo
              ? "Risk Radar is computed from your real business metrics. Exit demo mode to see your risks."
              : "Risks are detected from your uploaded sales data by the ML pipeline — declining sales, anomalies, margin pressure and demand shifts."}
          </p>
          <button onClick={() => router.push(isDemo ? "/businesses" : "/businesses/new")} className="q-btn q-btn-primary q-btn-sm" style={{ gap: 6 }}>
            <Plus size={14} /> {isDemo ? "Exit Demo" : "Add Business / Upload Data"}
          </button>
        </div>
      </div>
    );
  }

  const currency = selected?.currency || "USD";

  return (
    <div className="q-page-shell">
      <div className="q-page-header">
        <h1 className="q-page-title">Risk Radar</h1>
        <p className="q-page-subtitle">
          {selected?.businessName} · {risks.length} signal{risks.length === 1 ? "" : "s"} detected from your data
          {mlAnalytics?.processedAt ? ` · analysed ${new Date(mlAnalytics.processedAt).toLocaleString()}` : ""}
        </p>
      </div>

      {risks.length === 0 ? (
        <div className="q-card" style={{ padding: "40px 24px", textAlign: "center" }}>
          <Activity size={36} style={{ opacity: 0.3, marginBottom: 12 }} />
          <h3 style={{ fontWeight: 700, marginBottom: 6 }}>No risks detected</h3>
          <p style={{ color: "var(--q-text-3)", fontSize: "0.85rem" }}>Your current metrics look healthy across the signals we monitor.</p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {risks.map((r, i) => <RiskCard key={i} risk={r} />)}
        </div>
      )}

      <div className="q-card" style={{ padding: "14px 18px", marginTop: 20, display: "flex", gap: 10, alignItems: "flex-start" }}>
        <Info size={15} style={{ color: "var(--q-text-4)", flexShrink: 0, marginTop: 2 }} />
        <p style={{ fontSize: "0.78rem", color: "var(--q-text-4)", lineHeight: 1.6 }}>
          Every risk cites the metric that triggered it. Expense-based risks appear when your data includes cost/expense columns.
          Deep-dive into <button onClick={() => router.push("/analytics/ml")} style={{ background: "none", border: "none", color: "#2563EB", cursor: "pointer", fontWeight: 600, fontFamily: "inherit", padding: 0 }}>ML Analytics</button> for anomaly dates and reasons.
        </p>
      </div>
    </div>
  );
}
