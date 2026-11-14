"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useBusiness } from "@/context/BusinessContext";
import API from "@/config/api";
import { Globe, MapPin, Store, RefreshCw, Info, Plus, Loader2, Navigation } from "lucide-react";

export default function MarketPage() {
  const router = useRouter();
  const { isDemo, selected } = useBusiness();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  const load = () => {
    if (!selected?.id || isDemo) return;
    setLoading(true);
    API.get(`/businesses/${selected.id}/competitors`, { timeout: 140000 })
      .then((res) => setData(res.data))
      .catch((err) => setData({ error: err.response?.data?.message || err.message }))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [selected?.id, isDemo]);

  if (isDemo || !selected?.id) {
    return (
      <div className="q-page-shell">
        <h1 className="q-page-title">Market Intelligence</h1>
        <div style={{ maxWidth: 520, margin: "60px auto", textAlign: "center" }}>
          <Globe size={40} style={{ opacity: 0.25, marginBottom: 16 }} />
          <h2 style={{ fontWeight: 700, fontSize: "1.25rem", marginBottom: 10 }}>{isDemo ? "Demo mode" : "Select a business"}</h2>
          <p style={{ color: "var(--q-text-3)", lineHeight: 1.7, marginBottom: 24 }}>
            {isDemo ? "Competitor intelligence uses your business location. Exit demo mode to view it." : "Select or create a business with a location to discover nearby competitors."}
          </p>
          <button onClick={() => router.push("/businesses")} className="q-btn q-btn-primary q-btn-sm" style={{ gap: 6 }}>
            <Plus size={14} /> {isDemo ? "Exit Demo" : "Go to Businesses"}
          </button>
        </div>
      </div>
    );
  }

  const competitors = data?.competitors || [];
  const catCount = competitors.reduce((m, c) => { m[c.category] = (m[c.category] || 0) + 1; return m; }, {});

  return (
    <div className="q-page-shell">
      <div className="q-page-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 className="q-page-title">Market Intelligence</h1>
          <p className="q-page-subtitle">
            {selected.businessName} · nearby competitors from public map data
            {data?.fetchedAt ? ` · fetched ${new Date(data.fetchedAt).toLocaleString()}` : ""}
          </p>
        </div>
        <button className="q-btn q-btn-outline q-btn-sm" style={{ gap: 6 }} onClick={load} disabled={loading}>
          {loading ? <Loader2 size={14} className="q-spin" /> : <RefreshCw size={14} />} Refresh
        </button>
      </div>

      {!data && loading && (
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "40px 0", color: "var(--q-text-3)" }}>
          <div className="q-spinner" style={{ width: 24, height: 24, borderWidth: 2 }} /> Looking up nearby restaurants &amp; cafes…
        </div>
      )}

      {data && !data.hasLocation && (
        <div className="q-card" style={{ padding: "40px 24px", textAlign: "center", maxWidth: 560, margin: "30px auto" }}>
          <MapPin size={36} style={{ opacity: 0.3, marginBottom: 14 }} />
          <h3 style={{ fontWeight: 700, marginBottom: 8 }}>Location needed</h3>
          <p style={{ color: "var(--q-text-3)", fontSize: "0.87rem", marginBottom: 18 }}>{data.message}</p>
          <button onClick={() => router.push("/businesses")} className="q-btn q-btn-primary q-btn-sm" style={{ gap: 6 }}>
            <Plus size={14} /> Edit Business Location
          </button>
        </div>
      )}

      {data?.message && data.hasLocation && competitors.length === 0 && !loading && (
        <div className="q-card" style={{ padding: "32px 24px", textAlign: "center", maxWidth: 640, margin: "30px auto" }}>
          <Store size={36} style={{ opacity: 0.3, marginBottom: 14 }} />
          <p style={{ color: "var(--q-text-3)", fontSize: "0.88rem" }}>{data.message}</p>
          {data.location && (
            <p style={{ fontSize: "0.78rem", color: "var(--q-text-4)", marginTop: 8 }}>
              Searched near {data.location.displayName}
            </p>
          )}
        </div>
      )}

      {competitors.length > 0 && (
        <>
          {/* Summary */}
          <div className="q-kpi-grid" style={{ marginBottom: 24 }}>
            <div className="q-card" style={{ padding: "16px 18px" }}>
              <div style={{ fontSize: "0.7rem", color: "var(--q-text-4)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>Competitors Found</div>
              <div style={{ fontWeight: 800, fontSize: "1.4rem" }}>{competitors.length}</div>
              <div style={{ fontSize: "0.72rem", color: "var(--q-text-4)" }}>within ~3 km</div>
            </div>
            {Object.entries(catCount).map(([cat, n]) => (
              <div key={cat} className="q-card" style={{ padding: "16px 18px" }}>
                <div style={{ fontSize: "0.7rem", color: "var(--q-text-4)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>{cat}s</div>
                <div style={{ fontWeight: 800, fontSize: "1.4rem" }}>{n}</div>
              </div>
            ))}
            <div className="q-card" style={{ padding: "16px 18px" }}>
              <div style={{ fontSize: "0.7rem", color: "var(--q-text-4)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>Nearest</div>
              <div style={{ fontWeight: 800, fontSize: "1.1rem" }}>{competitors[0]?.distanceKm ?? "—"} km</div>
              <div style={{ fontSize: "0.72rem", color: "var(--q-text-4)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{competitors[0]?.name}</div>
            </div>
          </div>

          {/* List */}
          <div className="q-card" style={{ padding: 0, overflow: "hidden" }}>
            <div style={{ padding: "14px 20px", borderBottom: "1px solid var(--q-border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h3 style={{ fontWeight: 700, fontSize: "0.9rem" }}>Nearby Competitors</h3>
              <span className="q-badge q-badge-neutral">{data.source}</span>
            </div>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
                <thead>
                  <tr style={{ background: "var(--q-surface-2)", textAlign: "left" }}>
                    {["Name", "Type", "Cuisine", "Address", "Distance"].map((h) => (
                      <th key={h} style={{ padding: "11px 18px", fontWeight: 700, fontSize: "0.7rem", color: "var(--q-text-4)", textTransform: "uppercase", letterSpacing: "0.05em" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {competitors.map((c, i) => (
                    <tr key={`${c.osmType}-${c.osmId}-${i}`} style={{ borderTop: "1px solid var(--q-border)" }}>
                      <td style={{ padding: "10px 18px", fontWeight: 600 }}>{c.name}</td>
                      <td style={{ padding: "10px 18px" }}>
                        <span className={`q-badge ${c.category === "Cafe" ? "q-badge-warning" : "q-badge-neutral"}`}>{c.category}</span>
                      </td>
                      <td style={{ padding: "10px 18px", color: "var(--q-text-3)" }}>{c.cuisine || "—"}</td>
                      <td style={{ padding: "10px 18px", color: "var(--q-text-4)", fontSize: "0.8rem" }}>{c.address || "—"}</td>
                      <td style={{ padding: "10px 18px", whiteSpace: "nowrap" }}>
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 5, color: "var(--q-text-3)" }}>
                          <Navigation size={11} /> {c.distanceKm != null ? `${c.distanceKm} km` : "—"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <p style={{ fontSize: "0.75rem", color: "var(--q-text-4)", marginTop: 14, display: "flex", gap: 6, alignItems: "flex-start" }}>
            <Info size={13} style={{ flexShrink: 0, marginTop: 1 }} />
            {data.note || "Source: OpenStreetMap public data. Ratings, revenue and market share are not available from this source and are not estimated."}
          </p>
        </>
      )}
    </div>
  );
}
