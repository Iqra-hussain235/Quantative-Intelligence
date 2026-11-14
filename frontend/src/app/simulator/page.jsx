"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useBusiness } from "@/context/BusinessContext";
import API from "@/config/api";
import { Shuffle, Play, Info, TrendingUp, TrendingDown, Minus, Plus, Loader2 } from "lucide-react";

function Slider({ label, value, onChange, min, max, step = 1, suffix = "%", hint }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
        <label style={{ fontSize: "0.82rem", fontWeight: 600, color: "var(--q-text-2)" }}>{label}</label>
        <span className="q-badge q-badge-neutral" style={{ fontFamily: "monospace" }}>{value}{suffix}</span>
      </div>
      <input
        type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{ width: "100%", accentColor: "#2563EB" }}
      />
      {hint && <div style={{ fontSize: "0.72rem", color: "var(--q-text-4)", marginTop: 4 }}>{hint}</div>}
    </div>
  );
}

function Delta({ value, invert }) {
  if (value == null) return <span style={{ color: "var(--q-text-4)" }}>—</span>;
  const up = value > 0;
  const good = invert ? !up : up;
  const Icon = value === 0 ? Minus : up ? TrendingUp : TrendingDown;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontWeight: 700, color: good ? "#059669" : "#DC2626" }}>
      <Icon size={14} /> {up ? "+" : ""}{value}%
    </span>
  );
}

export default function SimulatorPage() {
  const router = useRouter();
  const { isDemo, selected } = useBusiness();

  const [inputs, setInputs] = useState({ priceChangePct: 0, discountPct: 0, marketingSpend: 0, costChangePct: 0, days: 30 });
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const set = (k) => (v) => setInputs((p) => ({ ...p, [k]: v }));
  const currency = result?.currency || selected?.currency || "USD";
  const fmt = (v) => v == null ? "—" : `${currency} ${Number(v).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;

  const run = async () => {
    if (!selected?.id || isDemo) return;
    setLoading(true); setError("");
    try {
      const res = await API.post(`/businesses/${selected.id}/simulate`, inputs);
      setResult(res.data);
    } catch (err) {
      setError(err.response?.data?.message || err.message || "Simulation failed.");
    } finally {
      setLoading(false);
    }
  };

  if (isDemo || !selected?.id) {
    return (
      <div className="q-page-shell">
        <h1 className="q-page-title">Decision Simulator</h1>
        <div style={{ maxWidth: 520, margin: "60px auto", textAlign: "center" }}>
          <Shuffle size={40} style={{ opacity: 0.25, marginBottom: 16 }} />
          <h2 style={{ fontWeight: 700, fontSize: "1.25rem", marginBottom: 10 }}>
            {isDemo ? "Demo mode" : "Select a business"}
          </h2>
          <p style={{ color: "var(--q-text-3)", lineHeight: 1.7, marginBottom: 24 }}>
            The simulator projects outcomes from your real accumulated sales history. Select a business with uploaded data to run scenarios.
          </p>
          <button onClick={() => router.push(isDemo ? "/businesses" : "/businesses")} className="q-btn q-btn-primary q-btn-sm" style={{ gap: 6 }}>
            <Plus size={14} /> {isDemo ? "Exit Demo" : "Go to Businesses"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="q-page-shell">
      <div className="q-page-header">
        <h1 className="q-page-title">Decision Simulator</h1>
        <p className="q-page-subtitle">
          {selected.businessName} · what-if scenarios computed from your last 90 days of real sales data
        </p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "minmax(300px, 380px) 1fr", gap: 24, alignItems: "start" }}>
        {/* Inputs */}
        <div className="q-card" style={{ padding: 24 }}>
          <h3 style={{ fontWeight: 700, fontSize: "0.95rem", marginBottom: 18 }}>Scenario Assumptions</h3>

          <Slider label="Price change" value={inputs.priceChangePct} onChange={set("priceChangePct")} min={-30} max={30} hint="Negative = price cut. Demand response uses ~-0.8 elasticity." />
          <Slider label="Discount / promo depth" value={inputs.discountPct} onChange={set("discountPct")} min={0} max={50} hint="Applied to order value; assumed to lift traffic." />
          <Slider label="Marketing spend" value={inputs.marketingSpend} onChange={set("marketingSpend")} min={0} max={50000} step={500} suffix="" hint={`One-off spend over the horizon — assumed ${result?.assumptions?.marketingROAS || 4}x ROAS.`} />
          <Slider label="Cost change (COGS)" value={inputs.costChangePct} onChange={set("costChangePct")} min={-20} max={30} hint="Ingredient/labour cost movement passed through to COGS." />
          <Slider label="Horizon" value={inputs.days} onChange={set("days")} min={7} max={90} step={7} suffix=" days" hint="Projection window." />

          <button className="q-btn q-btn-primary" style={{ width: "100%", gap: 8, marginTop: 6 }} onClick={run} disabled={loading}>
            {loading ? <Loader2 size={16} className="q-spin" /> : <Play size={16} />}
            {loading ? "Simulating…" : "Run Simulation"}
          </button>
          {error && <div style={{ marginTop: 12, padding: "10px 12px", background: "#FEF2F2", border: "1px solid #FCA5A5", borderRadius: 8, color: "#991B1B", fontSize: "0.8rem" }}>{error}</div>}

          {result?.assumptions && (
            <div style={{ marginTop: 18, padding: "12px 14px", background: "var(--q-surface-2)", borderRadius: 10, fontSize: "0.75rem", color: "var(--q-text-4)", lineHeight: 1.7 }}>
              <strong style={{ color: "var(--q-text-3)" }}>Baseline (last {result.assumptions.windowDays} days):</strong><br />
              {result.assumptions.baselineOrders} orders · AOV {fmt(result.assumptions.baselineAov)} · margin {result.assumptions.baselineMarginPct ?? "—"}%
            </div>
          )}
        </div>

        {/* Results */}
        <div>
          {!result ? (
            <div className="q-card" style={{ padding: "56px 24px", textAlign: "center" }}>
              <Shuffle size={36} style={{ opacity: 0.25, marginBottom: 14 }} />
              <h3 style={{ fontWeight: 700, marginBottom: 6 }}>No simulation yet</h3>
              <p style={{ color: "var(--q-text-3)", fontSize: "0.85rem", maxWidth: 380, margin: "0 auto" }}>
                Adjust the assumptions and run a simulation. Results are clearly marked as simulated — your actual data is never changed.
              </p>
            </div>
          ) : !result.hasBaseline ? (
            <div className="q-card" style={{ padding: "40px 24px", textAlign: "center" }}>
              <Info size={32} style={{ opacity: 0.3, marginBottom: 12 }} />
              <p style={{ color: "var(--q-text-3)", fontSize: "0.88rem" }}>{result.message}</p>
            </div>
          ) : (
            <>
              <div className="q-card" style={{ padding: 20, marginBottom: 16, borderLeft: "4px solid #D97706" }}>
                <div style={{ fontSize: "0.75rem", fontWeight: 700, color: "#D97706", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>
                  SIMULATED — not actual results
                </div>
                <p style={{ fontSize: "0.78rem", color: "var(--q-text-4)" }}>
                  Projection for the next {result.scenario.days} days based on your last {result.assumptions.windowDays} days of real data.
                </p>
              </div>

              <div className="q-kpi-grid" style={{ marginBottom: 16 }}>
                {[
                  { label: "Orders", base: result.baseline.orders, sim: result.simulated.orders, delta: result.deltas.ordersPct },
                  { label: "Revenue", base: fmt(result.baseline.revenue), sim: fmt(result.simulated.revenue), delta: result.deltas.revenuePct },
                  { label: "Profit", base: fmt(result.baseline.profit), sim: fmt(result.simulated.profit), delta: result.deltas.profitPct },
                  { label: "Margin", base: result.baseline.marginPct != null ? `${result.baseline.marginPct}%` : "—", sim: result.simulated.marginPct != null ? `${result.simulated.marginPct}%` : "—", delta: null },
                ].map((k) => (
                  <div key={k.label} className="q-card" style={{ padding: "16px 18px" }}>
                    <div style={{ fontSize: "0.72rem", color: "var(--q-text-4)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>{k.label}</div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 4 }}>
                      <span style={{ fontSize: "0.8rem", color: "var(--q-text-4)" }}>Actual</span>
                      <span style={{ fontWeight: 700 }}>{k.base}</span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                      <span style={{ fontSize: "0.8rem", color: "#D97706", fontWeight: 600 }}>Simulated</span>
                      <span style={{ fontWeight: 800, color: "#D97706" }}>{k.sim}</span>
                    </div>
                    {k.delta != null && <div style={{ marginTop: 6, fontSize: "0.78rem" }}><Delta value={k.delta} /></div>}
                  </div>
                ))}
              </div>

              <div className="q-card" style={{ padding: "14px 18px" }}>
                <p style={{ fontSize: "0.78rem", color: "var(--q-text-4)", lineHeight: 1.6 }}>
                  <Info size={12} style={{ display: "inline", marginRight: 6, verticalAlign: "-2px" }} />
                  Assumptions used: price elasticity ≈ {result.assumptions.elasticityUsed}, marketing at {result.assumptions.marketingROAS}x ROAS,
                  cost changes pass through to COGS. These are planning heuristics — actual outcomes depend on execution.
                </p>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
