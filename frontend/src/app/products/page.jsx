"use client";
import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useBusiness } from "@/context/BusinessContext";
import API from "@/config/api";
import { Package, Plus, Search, TrendingUp, Info } from "lucide-react";

const CATEGORY_COLORS = ["#2563EB", "#059669", "#D97706", "#7C3AED", "#DC2626", "#0891B2", "#DB2777", "#65A30D"];

export default function ProductsPage() {
  const router = useRouter();
  const { isDemo, selected } = useBusiness();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState("All");

  const currency = selected?.currency || "USD";
  const fmt = (v) => `${currency} ${Number(v || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;

  useEffect(() => {
    if (!selected?.id || isDemo) return;
    setLoading(true);
    API.get(`/businesses/${selected.id}/products`)
      .then((res) => setData(res.data))
      .catch(() => setData({ error: true }))
      .finally(() => setLoading(false));
  }, [selected?.id, isDemo]);

  const products = useMemo(() => {
    let list = data?.products || [];
    if (catFilter !== "All") list = list.filter((p) => (p.category || "Uncategorized") === catFilter);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter((p) => String(p.product).toLowerCase().includes(q) || String(p.sku || "").toLowerCase().includes(q));
    }
    return list;
  }, [data, catFilter, search]);

  if (isDemo || !selected?.id) {
    return (
      <div className="q-page-shell">
        <h1 className="q-page-title">Products</h1>
        <div style={{ maxWidth: 520, margin: "60px auto", textAlign: "center" }}>
          <Package size={40} style={{ opacity: 0.25, marginBottom: 16 }} />
          <h2 style={{ fontWeight: 700, fontSize: "1.25rem", marginBottom: 10 }}>{isDemo ? "Demo mode" : "Select a business"}</h2>
          <p style={{ color: "var(--q-text-3)", lineHeight: 1.7, marginBottom: 24 }}>
            {isDemo ? "Product analytics come from your real uploaded data. Exit demo mode to view them." : "Select or create a business with uploaded sales data."}
          </p>
          <button onClick={() => router.push("/businesses")} className="q-btn q-btn-primary q-btn-sm" style={{ gap: 6 }}>
            <Plus size={14} /> {isDemo ? "Exit Demo" : "Go to Businesses"}
          </button>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="q-page-shell">
        <h1 className="q-page-title">Products</h1>
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "40px 0", color: "var(--q-text-3)" }}>
          <div className="q-spinner" style={{ width: 24, height: 24, borderWidth: 2 }} /> Loading product analytics…
        </div>
      </div>
    );
  }

  const empty = !data || (data.totalProducts || 0) === 0;
  const maxSales = Math.max(...(data?.products || []).map((p) => p.sales || 0), 1);

  return (
    <div className="q-page-shell">
      <div className="q-page-header">
        <h1 className="q-page-title">Products / Menu</h1>
        <p className="q-page-subtitle">
          {selected.businessName} · {data?.totalProducts ?? 0} items · {fmt(data?.totalSales)} total sales — all from your uploaded data
        </p>
      </div>

      {empty ? (
        <div className="q-card" style={{ padding: "48px 24px", textAlign: "center", maxWidth: 560, margin: "30px auto" }}>
          <Package size={40} style={{ opacity: 0.25, marginBottom: 16 }} />
          <h3 style={{ fontWeight: 700, fontSize: "1.1rem", marginBottom: 8 }}>No product data yet</h3>
          <p style={{ color: "var(--q-text-3)", fontSize: "0.87rem", lineHeight: 1.6, marginBottom: 20 }}>
            Menu/product analytics appear once you upload sales data with product names or SKUs.
          </p>
          <button onClick={() => router.push("/analytics/ml")} className="q-btn q-btn-primary q-btn-sm" style={{ gap: 6 }}>
            <Plus size={14} /> Upload Data
          </button>
        </div>
      ) : (
        <>
          {/* Category performance */}
          {(data.categories || []).length > 0 && (
            <div className="q-card" style={{ padding: 20, marginBottom: 20 }}>
              <h3 style={{ fontWeight: 700, fontSize: "0.9rem", marginBottom: 14 }}>Category Performance</h3>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {data.categories.map((c, i) => (
                  <div key={c.category}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4, fontSize: "0.83rem" }}>
                      <button
                        onClick={() => setCatFilter(catFilter === c.category ? "All" : c.category)}
                        style={{ background: "none", border: "none", cursor: "pointer", fontWeight: 600, color: catFilter === c.category ? "#2563EB" : "var(--q-text-1)", fontFamily: "inherit", padding: 0 }}
                      >
                        {c.category}
                      </button>
                      <span style={{ color: "var(--q-text-3)" }}>
                        {fmt(c.sales)} · {c.sharePct}% · {c.quantity} units
                      </span>
                    </div>
                    <div className="q-progress-track" style={{ height: 6 }}>
                      <div style={{ height: "100%", width: `${Math.min(c.sharePct ?? 0, 100)}%`, background: CATEGORY_COLORS[i % CATEGORY_COLORS.length], borderRadius: 3 }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Filters */}
          <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
            <div style={{ position: "relative", flex: "1 1 240px" }}>
              <Search size={14} style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)", color: "var(--q-text-4)" }} />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search product or SKU…"
                style={{ width: "100%", padding: "9px 12px 9px 32px", borderRadius: 8, border: "1px solid var(--q-border)", background: "var(--q-surface-2)", color: "var(--q-text-1)", fontSize: "0.85rem", fontFamily: "inherit" }}
              />
            </div>
            {catFilter !== "All" && (
              <button className="q-btn q-btn-ghost q-btn-sm" onClick={() => setCatFilter("All")}>Clear: {catFilter}</button>
            )}
          </div>

          {/* Product table */}
          <div className="q-card" style={{ padding: 0, overflow: "hidden" }}>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
                <thead>
                  <tr style={{ background: "var(--q-surface-2)", textAlign: "left" }}>
                    {["Product", "Category", "Qty Sold", "Orders", "Sales", "Profit", "Margin", "Sales Share"].map((h) => (
                      <th key={h} style={{ padding: "12px 16px", fontWeight: 700, fontSize: "0.7rem", color: "var(--q-text-4)", textTransform: "uppercase", letterSpacing: "0.05em", whiteSpace: "nowrap" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {products.map((p) => {
                    const share = data.totalSales ? (p.sales / data.totalSales) * 100 : 0;
                    return (
                      <tr key={`${p.product}-${p.sku || ""}-${p.category || ""}`} style={{ borderTop: "1px solid var(--q-border)" }}>
                        <td style={{ padding: "10px 16px" }}>
                          <div style={{ fontWeight: 600 }}>{p.product}</div>
                          {p.sku && <div style={{ fontSize: "0.72rem", color: "var(--q-text-4)", fontFamily: "monospace" }}>{p.sku}</div>}
                        </td>
                        <td style={{ padding: "10px 16px", color: "var(--q-text-3)" }}>{p.category || "—"}</td>
                        <td style={{ padding: "10px 16px" }}>{p.quantity}</td>
                        <td style={{ padding: "10px 16px" }}>{p.orders}</td>
                        <td style={{ padding: "10px 16px", fontWeight: 700 }}>{fmt(p.sales)}</td>
                        <td style={{ padding: "10px 16px", color: (p.profit ?? 0) >= 0 ? "#059669" : "#DC2626", fontWeight: 600 }}>
                          {p.profit != null ? fmt(p.profit) : "—"}
                        </td>
                        <td style={{ padding: "10px 16px", color: "var(--q-text-3)" }}>{p.marginPct != null ? `${p.marginPct}%` : "—"}</td>
                        <td style={{ padding: "10px 16px" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <div className="q-progress-track" style={{ width: 60, height: 5 }}>
                              <div style={{ height: "100%", width: `${Math.min(share, 100)}%`, background: "#2563EB", borderRadius: 3 }} />
                            </div>
                            <span style={{ fontSize: "0.75rem", color: "var(--q-text-4)", minWidth: 38 }}>{share.toFixed(1)}%</span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {products.length === 0 && (
                    <tr><td colSpan={8} style={{ padding: "24px", textAlign: "center", color: "var(--q-text-4)" }}>No products match this filter.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <p style={{ fontSize: "0.75rem", color: "var(--q-text-4)", marginTop: 14, display: "flex", alignItems: "center", gap: 6 }}>
            <Info size={12} /> Sorted by total sales. Profit uses cost/profit columns when present in your uploads.
            <span style={{ marginLeft: "auto", display: "inline-flex", alignItems: "center", gap: 4 }}>
              <TrendingUp size={12} /> Demand predictions on the <button onClick={() => router.push("/predictions")} style={{ background: "none", border: "none", color: "#2563EB", cursor: "pointer", fontWeight: 600, fontFamily: "inherit", padding: 0 }}>Predictions</button> page.
            </span>
          </p>
        </>
      )}
    </div>
  );
}
