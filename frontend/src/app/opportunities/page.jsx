"use client";
import { useRouter } from "next/navigation";
import { useBusiness } from "@/context/BusinessContext";
import { Lightbulb, ArrowRight, Plus, TrendingUp, Info, Sparkles } from "lucide-react";
import { useMemo } from "react";

const SEV = {
  high: { dot: "#2563EB", bg: "#EFF6FF", border: "#BFDBFE" },
  medium: { dot: "#059669", bg: "#ECFDF5", border: "#A7F3D0" },
  low: { dot: "#7C3AED", bg: "#F5F3FF", border: "#DDD6FE" },
};

function Card({ item, kind }) {
  const c = SEV[item.severity] || SEV.low;
  const icon = kind === "opportunity" ? TrendingUp : kind === "recommendation" ? Sparkles : Lightbulb;
  const Icon = icon;
  return (
    <div style={{ background: c.bg, border: `1px solid ${c.border}`, borderRadius: 14, padding: 18 }}>
      <div style={{ display: "flex", gap: 12 }}>
        <div style={{ width: 36, height: 36, borderRadius: 10, background: c.dot + "18", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <Icon size={16} style={{ color: c.dot }} />
        </div>
        <div style={{ flex: 1 }}>
          <h3 style={{ fontWeight: 700, fontSize: "0.95rem", marginBottom: 5 }}>{item.title}</h3>
          {item.detail && <p style={{ fontSize: "0.83rem", color: "var(--q-text-3)", lineHeight: 1.6 }}>{item.detail}</p>}
          {item.metric && <div style={{ fontSize: "0.7rem", color: "var(--q-text-4)", fontFamily: "monospace", marginTop: 6 }}>based on: {item.metric}</div>}
        </div>
      </div>
    </div>
  );
}

function Section({ title, items, kind, empty }) {
  return (
    <div style={{ marginBottom: 28 }}>
      <h2 style={{ fontSize: "1rem", fontWeight: 700, marginBottom: 14 }}>{title} <span className="q-badge q-badge-neutral">{items.length}</span></h2>
      {items.length === 0 ? (
        <div className="q-card" style={{ padding: "24px", textAlign: "center", color: "var(--q-text-4)", fontSize: "0.85rem" }}>{empty}</div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 14 }}>
          {items.map((it, i) => <Card key={i} item={it} kind={kind} />)}
        </div>
      )}
    </div>
  );
}

export default function OpportunitiesPage() {
  const router = useRouter();
  const { isDemo, hasMLData, mlAnalytics, selected } = useBusiness();

  const { opportunities, recommendations } = useMemo(() => {
    if (isDemo || !hasMLData) return { opportunities: [], recommendations: [] };
    const ins = mlAnalytics?.mlResults?.insights || {};
    return {
      opportunities: ins.opportunities || [],
      recommendations: ins.recommendations || [],
    };
  }, [isDemo, hasMLData, mlAnalytics]);

  if (isDemo || !hasMLData) {
    return (
      <div className="q-page-shell">
        <h1 className="q-page-title">Opportunity Radar</h1>
        <div style={{ maxWidth: 520, margin: "60px auto", textAlign: "center" }}>
          <Lightbulb size={40} style={{ opacity: 0.25, marginBottom: 16 }} />
          <h2 style={{ fontWeight: 700, fontSize: "1.25rem", marginBottom: 10 }}>
            {isDemo ? "Demo mode" : "No opportunity data yet"}
          </h2>
          <p style={{ color: "var(--q-text-3)", lineHeight: 1.7, marginBottom: 24 }}>
            {isDemo
              ? "Opportunities are computed from your real business metrics. Exit demo mode to see yours."
              : "Opportunities and recommendations are derived from your actual sales, product, customer and forecast data."}
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
        <h1 className="q-page-title">Opportunity Radar</h1>
        <p className="q-page-subtitle">
          {selected?.businessName} · growth signals &amp; data-backed recommendations
          {mlAnalytics?.processedAt ? ` · analysed ${new Date(mlAnalytics.processedAt).toLocaleString()}` : ""}
        </p>
      </div>

      <Section title="Opportunities" items={opportunities} kind="opportunity" empty="No opportunities detected in current data." />
      <Section title="Recommended Actions" items={recommendations} kind="recommendation" empty="No recommendations yet." />

      <div className="q-card" style={{ padding: "14px 18px", display: "flex", gap: 10, alignItems: "flex-start" }}>
        <Info size={15} style={{ color: "var(--q-text-4)", flexShrink: 0, marginTop: 2 }} />
        <p style={{ fontSize: "0.78rem", color: "var(--q-text-4)", lineHeight: 1.6 }}>
          Signals are rule-based and cite the metric behind each one — no generic advice. Simulate the impact of acting on these in the{" "}
          <button onClick={() => router.push("/simulator")} style={{ background: "none", border: "none", color: "#2563EB", cursor: "pointer", fontWeight: 600, fontFamily: "inherit", padding: 0 }}>Decision Simulator</button>.
        </p>
      </div>
    </div>
  );
}
