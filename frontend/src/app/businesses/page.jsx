"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useBusiness } from "@/context/BusinessContext";
import API from "@/config/api";
import {
  Building2, Plus, Activity, BarChart3,
  Eye, ChevronRight, Pencil, UploadCloud, History, Loader2, X, MoreHorizontal,
  Sparkles, MapPin, CalendarDays, UtensilsCrossed, Coffee,
} from "lucide-react";

const TYPE_META = {
  restaurant: { label: "Restaurant", icon: UtensilsCrossed, color: "#DC2626" },
  cafe: { label: "Cafe", icon: Coffee, color: "#92400E" },
};

function typeMeta(biz) {
  const t = (biz.businessType || biz.industry || "").toString().toLowerCase();
  if (t.includes("cafe") || t.includes("coffee")) return TYPE_META.cafe;
  return TYPE_META.restaurant;
}

function fmtDate(d) {
  if (!d) return "—";
  try { return new Date(d).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" }); }
  catch { return "—"; }
}

function BusinessCard({ biz, onSelect, router, onEdit }) {
  const [menu, setMenu] = useState(false);
  const meta = typeMeta(biz);
  const Icon = meta.icon;
  const location = [biz.city, biz.state, biz.country].filter(Boolean).join(", ");

  return (
    <div
      className="q-card q-card-hover"
      style={{ padding: 24, cursor: "pointer", position: "relative" }}
      onClick={() => onSelect(biz)}
    >
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{
            width: 48, height: 48, borderRadius: 12,
            background: `linear-gradient(135deg, ${meta.color}, ${meta.color}99)`,
            display: "flex", alignItems: "center", justifyContent: "center",
            color: "#fff", flexShrink: 0,
          }}>
            <Icon size={22} />
          </div>
          <div>
            <h3 style={{ fontWeight: 700, fontSize: "1.0625rem", color: "var(--q-text-1)", marginBottom: 4 }}>{biz.businessName || biz.name || "Untitled Business"}</h3>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              <span className="q-badge q-badge-neutral">{meta.label}</span>
              {biz.businessModel && <span className="q-badge q-badge-neutral">{biz.businessModel}</span>}
            </div>
          </div>
        </div>
        <div style={{ position: "relative" }}>
          <button
            className="q-btn q-btn-ghost q-btn-icon"
            onClick={e => { e.stopPropagation(); setMenu(!menu); }}
            style={{ borderRadius: 8 }}
          >
            <MoreHorizontal size={16} />
          </button>
          {menu && (
            <div style={{
              position: "absolute", top: "100%", right: 0, zIndex: 10,
              background: "var(--q-surface)", border: "1px solid var(--q-border)",
              borderRadius: 10, boxShadow: "var(--q-shadow-lg)", minWidth: 180, marginTop: 4,
            }}>
              {[
                { label: "View Dashboard", icon: Eye, action: () => { onSelect(biz); router.push("/dashboard"); } },
                { label: "Upload / Import Data", icon: UploadCloud, action: () => { onSelect(biz); router.push("/analytics"); } },
                { label: "ML Analytics", icon: BarChart3, action: () => { onSelect(biz); router.push("/analytics/ml"); } },
                { label: "Import History", icon: History, action: () => { onSelect(biz); router.push("/analytics"); } },
                { label: "Edit Details", icon: Pencil, action: () => onEdit(biz) },
              ].map(item => (
                <button
                  key={item.label}
                  onClick={e => { e.stopPropagation(); item.action(); setMenu(false); }}
                  style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 16px", width: "100%", border: "none", background: "none", cursor: "pointer", fontSize: "0.875rem", color: "var(--q-text-2)", fontFamily: "inherit" }}
                  onMouseEnter={e => { e.currentTarget.style.background = "var(--q-surface-2)"; }}
                  onMouseLeave={e => { e.currentTarget.style.background = "none"; }}
                >
                  <item.icon size={14} /> {item.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Details */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: "14px 16px", background: "var(--q-surface-2)", borderRadius: 10, marginBottom: 18 }}>
        {location && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: "0.8125rem", color: "var(--q-text-3)" }}>
            <MapPin size={13} style={{ color: "var(--q-text-4)", flexShrink: 0 }} />
            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{location}</span>
          </div>
        )}
        <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: "0.8125rem", color: "var(--q-text-3)" }}>
          <CalendarDays size={13} style={{ color: "var(--q-text-4)", flexShrink: 0 }} />
          <span>Added {fmtDate(biz.createdAt)}</span>
        </div>
        {biz.uploadedFile && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: "0.8125rem", color: "var(--q-text-3)" }}>
            <Activity size={13} style={{ color: "#059669", flexShrink: 0 }} />
            <span>Dataset uploaded · ML analysis available</span>
          </div>
        )}
      </div>

      <button
        className="q-btn q-btn-primary q-btn-sm"
        style={{ width: "100%", gap: 6 }}
        onClick={e => { e.stopPropagation(); onSelect(biz); router.push("/dashboard"); }}
      >
        Open Dashboard <ChevronRight size={14} />
      </button>
    </div>
  );
}

export default function BusinessesPage() {
  const router = useRouter();
  const { businesses, loading, selectBusiness, isDemo, fetchBusinesses } = useBusiness();

  const [editing, setEditing] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [editError, setEditError] = useState("");

  const handleSelect = (biz) => {
    selectBusiness(biz);
    router.push("/dashboard");
  };

  const openEdit = (biz) => {
    setEditing(biz);
    setEditForm({
      businessName: biz.businessName || "",
      businessType: biz.businessType || "",
      city: biz.city || "",
      state: biz.state || "",
      country: biz.country || "",
      currency: biz.currency || "USD",
      website: biz.website || "",
    });
    setEditError("");
  };

  const saveEdit = async () => {
    if (!editing?.id) return;
    setSaving(true); setEditError("");
    try {
      await API.patch(`/businesses/${editing.id}`, {
        businessName: editForm.businessName,
        businessType: editForm.businessType || undefined,
        city: editForm.city || null,
        state: editForm.state || null,
        country: editForm.country || null,
        currency: editForm.currency || undefined,
        website: editForm.website || null,
      });
      setEditing(null);
      fetchBusinesses?.();
    } catch (err) {
      setEditError(err.response?.data?.message || err.message || "Failed to save.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="q-page-shell">
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 28 }}>
        <div>
          <h1 className="q-page-title">My Businesses</h1>
          <p className="q-page-subtitle">Manage your restaurant &amp; cafe businesses</p>
        </div>
        <button
          className="q-btn q-btn-primary q-btn-sm"
          onClick={() => router.push("/businesses/new")}
          style={{ gap: 6 }}
        >
          <Plus size={15} /> Add Business
        </button>
      </div>

      {/* ── Businesses ── */}
      <div style={{ marginBottom: 32 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
          <h2 style={{ fontSize: "1rem", fontWeight: 700 }}>Your Businesses</h2>
          <span className="q-badge q-badge-neutral">{businesses.length}</span>
        </div>

        {loading ? (
          <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "32px 0", color: "var(--q-text-3)" }}>
            <div className="q-spinner" style={{ width: 24, height: 24, borderWidth: 2 }} />
            Loading your businesses…
          </div>
        ) : businesses.length === 0 ? (
          <div className="q-card" style={{ padding: "48px 24px", textAlign: "center" }}>
            <div style={{ fontSize: "2.5rem", marginBottom: 14, opacity: 0.3 }}>🍽️</div>
            <h3 style={{ fontWeight: 700, fontSize: "1.125rem", marginBottom: 8 }}>No businesses yet</h3>
            <p style={{ color: "var(--q-text-3)", fontSize: "0.875rem", maxWidth: 380, margin: "0 auto 20px", lineHeight: 1.6 }}>
              Add your restaurant or cafe, then upload your sales data (CSV/Excel) to unlock ML-powered analytics.
            </p>
            <button className="q-btn q-btn-primary q-btn-sm" style={{ gap: 6 }} onClick={() => router.push("/businesses/new")}>
              <Plus size={15} /> Add Your First Business
            </button>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(360px, 1fr))", gap: 20 }}>
            {businesses.map(biz => (
              <BusinessCard key={biz.id} biz={biz} onSelect={handleSelect} router={router} onEdit={openEdit} />
            ))}

            {/* Add New Business Card */}
            <button
              onClick={() => router.push("/businesses/new")}
              style={{
                padding: 24, borderRadius: 16, border: "2px dashed var(--q-border)",
                background: "transparent", cursor: "pointer", fontFamily: "inherit",
                display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                gap: 14, minHeight: 220, transition: "all 0.2s",
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = "#2563EB"; e.currentTarget.style.background = "#EFF6FF"; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--q-border)"; e.currentTarget.style.background = "transparent"; }}
            >
              <div style={{ width: 56, height: 56, borderRadius: "50%", background: "var(--q-surface-2)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Plus size={24} color="var(--q-text-4)" />
              </div>
              <div style={{ textAlign: "center" }}>
                <div style={{ fontWeight: 600, fontSize: "0.9375rem", color: "var(--q-text-2)", marginBottom: 6 }}>Add New Business</div>
                <div style={{ fontSize: "0.8125rem", color: "var(--q-text-4)" }}>Restaurant or cafe — get ML-powered insights</div>
              </div>
            </button>
          </div>
        )}
      </div>

      {/* ── Portfolio Overview ── */}
      {businesses.length > 0 && (
        <div className="q-card" style={{ padding: 24 }}>
          <h3 style={{ fontWeight: 700, fontSize: "0.9375rem", marginBottom: 20 }}>Portfolio Overview</h3>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 16 }}>
            {[
              { label: "Total Businesses", value: String(businesses.length), icon: Building2, color: "#2563EB" },
              { label: "Restaurants", value: String(businesses.filter(b => !typeMeta(b).label.includes("Cafe")).length), icon: UtensilsCrossed, color: "#DC2626" },
              { label: "Cafes", value: String(businesses.filter(b => typeMeta(b).label === "Cafe").length), icon: Coffee, color: "#92400E" },
              { label: "With ML Data", value: String(businesses.filter(b => b.uploadedFile).length), icon: Sparkles, color: "#059669" },
            ].map(stat => (
              <div key={stat.label} style={{ textAlign: "center", padding: "16px 12px", background: "var(--q-surface-2)", borderRadius: 10 }}>
                <div style={{ width: 32, height: 32, borderRadius: 8, background: stat.color + "18", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 10px" }}>
                  <stat.icon size={15} style={{ color: stat.color }} />
                </div>
                <div style={{ fontSize: "1.375rem", fontWeight: 800, color: "var(--q-text-1)", marginBottom: 4 }}>{stat.value}</div>
                <div style={{ fontSize: "0.75rem", color: "var(--q-text-4)" }}>{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Edit business modal ── */}
      {editing && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}
          onClick={() => setEditing(null)}>
          <div className="q-card" style={{ width: "100%", maxWidth: 480, padding: 26 }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <h2 style={{ fontWeight: 800, fontSize: "1.1rem" }}>Edit Business</h2>
              <button onClick={() => setEditing(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--q-text-4)" }}><X size={18} /></button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {[
                { k: "businessName", label: "Business Name", required: true },
                { k: "businessType", label: "Type (Restaurant / Cafe)" },
                { k: "city", label: "City" },
                { k: "state", label: "State" },
                { k: "country", label: "Country" },
                { k: "currency", label: "Currency (e.g. USD, INR, PKR)" },
                { k: "website", label: "Website" },
              ].map((f) => (
                <div key={f.k}>
                  <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 600, color: "var(--q-text-3)", marginBottom: 5, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                    {f.label}{f.required ? " *" : ""}
                  </label>
                  <input
                    value={editForm[f.k] || ""}
                    onChange={(e) => setEditForm((p) => ({ ...p, [f.k]: e.target.value }))}
                    style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid var(--q-border)", background: "var(--q-surface-2)", color: "var(--q-text-1)", fontSize: "0.88rem", fontFamily: "inherit" }}
                  />
                </div>
              ))}
              {editError && <div style={{ padding: "10px 12px", background: "#FEF2F2", border: "1px solid #FCA5A5", borderRadius: 8, color: "#991B1B", fontSize: "0.82rem" }}>{editError}</div>}
              <div style={{ display: "flex", gap: 10, marginTop: 6 }}>
                <button className="q-btn q-btn-outline" style={{ flex: 1 }} onClick={() => setEditing(null)} disabled={saving}>Cancel</button>
                <button className="q-btn q-btn-primary" style={{ flex: 1, gap: 6 }} onClick={saveEdit} disabled={saving}>
                  {saving ? <Loader2 size={15} className="q-spin" /> : <Pencil size={15} />} Save Changes
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
