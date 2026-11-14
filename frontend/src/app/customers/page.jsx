"use client";
import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useBusiness } from "@/context/BusinessContext";
import API from "@/config/api";
import { Users, Repeat, Wallet, UserCheck, Plus, Info, Crown, Star, User } from "lucide-react";

const SEG_META = {
  VIP: { icon: Crown, color: "#D97706", bg: "#FEF3C7" },
  Regular: { icon: Star, color: "#2563EB", bg: "#DBEAFE" },
  Occasional: { icon: User, color: "#6B7280", bg: "#F3F4F6" },
  New: { icon: UserCheck, color: "#059669", bg: "#D1FAE5" },
};

export default function CustomersPage() {
  const router = useRouter();
  const { isDemo, selected, hasMLData } = useBusiness();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [segFilter, setSegFilter] = useState("All");
  const [search, setSearch] = useState("");

  const currency = selected?.currency || "USD";
  const fmt = (v) => `${currency} ${Number(v || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;

  useEffect(() => {
    if (!selected?.id || isDemo) return;
    setLoading(true);
    API.get(`/businesses/${selected.id}/customers`)
      .then((res) => setData(res.data))
      .catch(() => setData({ error: true }))
      .finally(() => setLoading(false));
  }, [selected?.id, isDemo]);

  const customers = useMemo(() => {
    let list = data?.customers || [];
    if (segFilter !== "All") list = list.filter((c) => c.segment === segFilter);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter((c) => String(c.customerId).toLowerCase().includes(q));
    }
    return list;
  }, [data, segFilter, search]);

  if (isDemo || !selected?.id) {
    return (
      <EmptyWrap router={router} isDemo={isDemo} title="Customers" />
    );
  }

  if (loading) {
    return (
      <div className="q-page-shell">
        <h1 className="q-page-title">Customers</h1>
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "40px 0", color: "var(--q-text-3)" }}>
          <div className="q-spinner" style={{ width: 24, height: 24, borderWidth: 2 }} /> Loading customer analytics…
        </div>
      </div>
    );
  }

  const empty = !data || data.totalCustomers === 0;

  return (
    <div className="q-page-shell">
      <div className="q-page-header">
        <h1 className="q-page-title">Customers</h1>
        <p className="q-page-subtitle">
          {selected.businessName} · real customers from your uploaded order data — never fabricated
        </p>
      </div>

      {empty ? (
        <div className="q-card" style={{ padding: "48px 24px", textAlign: "center", maxWidth: 560, margin: "30px auto" }}>
          <Users size={40} style={{ opacity: 0.25, marginBottom: 16 }} />
          <h3 style={{ fontWeight: 700, fontSize: "1.1rem", marginBottom: 8 }}>No customer data yet</h3>
          <p style={{ color: "var(--q-text-3)", fontSize: "0.87rem", lineHeight: 1.6, marginBottom: 20 }}>
            Customer analytics appear once you upload sales data containing customer identifiers.
            Walk-in customers are counted separately and excluded from identified-customer stats.
          </p>
          <button onClick={() => router.push("/analytics/ml")} className="q-btn q-btn-primary q-btn-sm" style={{ gap: 6 }}>
            <Plus size={14} /> Upload Data
          </button>
        </div>
      ) : (
        <>
          {/* KPI strip */}
          <div className="q-kpi-grid" style={{ marginBottom: 24 }}>
            {[
              { label: "Identified Customers", value: data.totalCustomers.toLocaleString(), icon: Users, color: "#7C3AED" },
              { label: "Repeat Rate", value: data.repeatRatePct != null ? `${data.repeatRatePct}%` : "—", icon: Repeat, color: "#059669" },
              { label: "Avg Orders / Customer", value: data.avgOrdersPerCustomer ?? "—", icon: UserCheck, color: "#2563EB" },
              { label: "Avg Spend / Customer", value: fmt(data.avgSpendPerCustomer), icon: Wallet, color: "#D97706" },
              { label: "Walk-in Orders", value: (data.walkInOrders || 0).toLocaleString(), icon: Info, color: "#0891B2" },
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

          {/* Segments */}
          <div className="q-card" style={{ padding: 20, marginBottom: 20 }}>
            <h3 style={{ fontWeight: 700, fontSize: "0.9rem", marginBottom: 14 }}>Customer Segments</h3>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 12 }}>
              {Object.entries(data.segments || {}).map(([seg, count]) => {
                const m = SEG_META[seg] || SEG_META.Occasional;
                const active = segFilter === seg;
                return (
                  <button
                    key={seg}
                    onClick={() => setSegFilter(active ? "All" : seg)}
                    style={{
                      padding: "14px 12px", borderRadius: 10, cursor: "pointer", fontFamily: "inherit",
                      border: `1.5px solid ${active ? m.color : "var(--q-border)"}`,
                      background: active ? m.bg : "var(--q-surface-2)", textAlign: "center",
                    }}
                  >
                    <m.icon size={18} style={{ color: m.color, marginBottom: 6 }} />
                    <div style={{ fontWeight: 700, fontSize: "1.1rem" }}>{count}</div>
                    <div style={{ fontSize: "0.72rem", color: "var(--q-text-4)", fontWeight: 600 }}>{seg}</div>
                  </button>
                );
              })}
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: 14, alignItems: "center" }}>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search customer ID…"
                style={{ flex: 1, padding: "9px 12px", borderRadius: 8, border: "1px solid var(--q-border)", background: "var(--q-surface-2)", color: "var(--q-text-1)", fontSize: "0.85rem", fontFamily: "inherit" }}
              />
              {segFilter !== "All" && (
                <button className="q-btn q-btn-ghost q-btn-sm" onClick={() => setSegFilter("All")}>Clear filter</button>
              )}
            </div>
          </div>

          {/* Table */}
          <div className="q-card" style={{ padding: 0, overflow: "hidden" }}>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
                <thead>
                  <tr style={{ background: "var(--q-surface-2)", textAlign: "left" }}>
                    {["Customer", "Segment", "Orders", "Total Spend", "Avg Order", "First Order", "Last Order"].map((h) => (
                      <th key={h} style={{ padding: "12px 16px", fontWeight: 700, fontSize: "0.72rem", color: "var(--q-text-4)", textTransform: "uppercase", letterSpacing: "0.05em", whiteSpace: "nowrap" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {customers.slice(0, 100).map((c) => {
                    const m = SEG_META[c.segment] || SEG_META.Occasional;
                    return (
                      <tr key={c.customerId} style={{ borderTop: "1px solid var(--q-border)" }}>
                        <td style={{ padding: "10px 16px", fontWeight: 600 }}>{c.customerId}</td>
                        <td style={{ padding: "10px 16px" }}>
                          <span className="q-badge" style={{ background: m.bg, color: m.color }}>{c.segment}</span>
                        </td>
                        <td style={{ padding: "10px 16px" }}>{c.orders}</td>
                        <td style={{ padding: "10px 16px", fontWeight: 700 }}>{fmt(c.totalSales)}</td>
                        <td style={{ padding: "10px 16px", color: "var(--q-text-3)" }}>{fmt(c.avgOrderValue)}</td>
                        <td style={{ padding: "10px 16px", color: "var(--q-text-4)" }}>{c.firstOrder || "—"}</td>
                        <td style={{ padding: "10px 16px", color: "var(--q-text-4)" }}>{c.lastOrder || "—"}</td>
                      </tr>
                    );
                  })}
                  {customers.length === 0 && (
                    <tr><td colSpan={7} style={{ padding: "24px", textAlign: "center", color: "var(--q-text-4)" }}>No customers match this filter.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
            {customers.length > 100 && (
              <div style={{ padding: "10px 16px", fontSize: "0.75rem", color: "var(--q-text-4)", borderTop: "1px solid var(--q-border)" }}>
                Showing top 100 of {customers.length} customers
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function EmptyWrap({ router, isDemo, title }) {
  return (
    <div className="q-page-shell">
      <h1 className="q-page-title">{title}</h1>
      <div style={{ maxWidth: 520, margin: "60px auto", textAlign: "center" }}>
        <Users size={40} style={{ opacity: 0.25, marginBottom: 16 }} />
        <h2 style={{ fontWeight: 700, fontSize: "1.25rem", marginBottom: 10 }}>{isDemo ? "Demo mode" : "Select a business"}</h2>
        <p style={{ color: "var(--q-text-3)", lineHeight: 1.7, marginBottom: 24 }}>
          {isDemo ? "Customer analytics come from your real uploaded data. Exit demo mode to view them." : "Select or create a business with uploaded sales data."}
        </p>
        <button onClick={() => router.push(isDemo ? "/businesses" : "/businesses")} className="q-btn q-btn-primary q-btn-sm" style={{ gap: 6 }}>
          <Plus size={14} /> {isDemo ? "Exit Demo" : "Go to Businesses"}
        </button>
      </div>
    </div>
  );
}
