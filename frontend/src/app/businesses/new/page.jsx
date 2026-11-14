"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import API from "@/config/api";
import { useBusiness } from "@/context/BusinessContext";
import {
  ArrowLeft, UtensilsCrossed, Coffee, Loader2, CheckCircle2,
  Store, MapPin, UploadCloud, FileSpreadsheet, X, AlertCircle,
} from "lucide-react";

const COUNTRIES = [
  "India", "United States", "United Kingdom", "United Arab Emirates",
  "Saudi Arabia", "Pakistan", "Bangladesh", "Canada", "Australia",
  "Germany", "France", "Singapore", "Malaysia", "Other",
];

const BUSINESS_TYPES = [
  { id: "Restaurant", label: "Restaurant", desc: "Restaurant, food service, cloud kitchen", icon: UtensilsCrossed, color: "#DC2626" },
  { id: "Cafe", label: "Cafe", desc: "Coffee shop, bakery, dessert bar", icon: Coffee, color: "#92400E" },
];

const inputStyle = {
  width: "100%", padding: "11px 14px", borderRadius: 10,
  background: "var(--q-surface-2)", border: "1px solid var(--q-border)",
  color: "var(--q-text-1)", fontSize: "0.9rem", fontFamily: "inherit",
  outline: "none", boxSizing: "border-box",
};
const labelStyle = {
  display: "block", fontSize: "0.8rem", fontWeight: 600,
  color: "var(--q-text-3)", marginBottom: 6, textTransform: "uppercase",
  letterSpacing: "0.05em",
};

export default function NewBusinessPage() {
  const router = useRouter();
  const { addBusiness, selectBusiness, refreshMLAnalytics } = useBusiness();

  const [step, setStep] = useState(1); // 1 = details, 2 = upload
  const [form, setForm] = useState({ businessName: "", businessType: "", city: "", state: "", country: "" });
  const [created, setCreated] = useState(null);
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [uploadResult, setUploadResult] = useState(null);

  const set = (k) => (e) => setForm((p) => ({ ...p, [k]: e.target.value }));

  const createBusiness = async (e) => {
    e.preventDefault();
    setError("");
    if (!form.businessName.trim()) { setError("Business name is required."); return; }
    if (!form.businessType) { setError("Please select Restaurant or Cafe."); return; }

    setLoading(true);
    try {
      const payload = {
        businessName: form.businessName.trim(),
        businessType: form.businessType,
        industry: "Food & Beverage",
        businessModel: "B2C",
        operatingModel: "offline_only",
        city: form.city || null,
        state: form.state || null,
        country: form.country || null,
        currency: "USD",
        stage: "Startup",
      };
      const res = await API.post("/businesses", payload);
      const biz = res.data?.business;
      if (biz) {
        addBusiness(biz);
        selectBusiness(biz);
        setCreated(biz);
        setStep(2);
      }
    } catch (err) {
      setError(err.response?.data?.message || err.message || "Failed to create business.");
    } finally {
      setLoading(false);
    }
  };

  const uploadFile = async () => {
    if (!file || !created) return;
    setUploading(true);
    setError("");
    setUploadResult(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await API.post(`/businesses/${created.id}/ml-upload`, fd, {
        headers: { "Content-Type": "multipart/form-data" },
        timeout: 180000,
      });
      setUploadResult(res.data?.summary || res.data);
      refreshMLAnalytics?.();
    } catch (err) {
      setError(err.response?.data?.message || err.message || "Upload/processing failed.");
    } finally {
      setUploading(false);
    }
  };

  // ── Step 2: upload ─────────────────────────────────────────────────────────
  if (step === 2 && created) {
    return (
      <div className="q-page-shell" style={{ maxWidth: 640, margin: "0 auto" }}>
        <button onClick={() => router.push("/dashboard")} className="q-btn q-btn-ghost q-btn-sm" style={{ gap: 6, marginBottom: 20 }}>
          <ArrowLeft size={15} /> Back to dashboard
        </button>

        <div style={{ marginBottom: 24 }}>
          <h1 className="q-page-title">Upload Sales Data</h1>
          <p className="q-page-subtitle">
            <strong>{created.businessName}</strong> — upload your sales/orders CSV or Excel file.
            New files are <em>added</em> to your existing history; overlapping records are
            detected and never double-counted.
          </p>
        </div>

        <div className="q-card" style={{ padding: 28 }}>
          {!uploadResult ? (
            <>
              <label
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files?.[0]; if (f) setFile(f); }}
                style={{
                  display: "block", border: "2px dashed var(--q-border)", borderRadius: 14,
                  padding: "36px 20px", textAlign: "center", cursor: "pointer",
                  background: file ? "var(--q-surface-2)" : "transparent", transition: "all .15s",
                }}
              >
                <input
                  type="file" accept=".csv,.xlsx,.xls" style={{ display: "none" }}
                  onChange={(e) => setFile(e.target.files?.[0] || null)}
                />
                {file ? (
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10 }}>
                    <FileSpreadsheet size={22} color="#2563EB" />
                    <div style={{ textAlign: "left" }}>
                      <div style={{ fontWeight: 700, fontSize: "0.9rem" }}>{file.name}</div>
                      <div style={{ fontSize: "0.78rem", color: "var(--q-text-4)" }}>{(file.size / 1024).toFixed(1)} KB</div>
                    </div>
                    <button type="button" onClick={(e) => { e.stopPropagation(); setFile(null); }} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--q-text-4)" }}>
                      <X size={16} />
                    </button>
                  </div>
                ) : (
                  <>
                    <UploadCloud size={34} color="var(--q-text-4)" style={{ marginBottom: 10 }} />
                    <div style={{ fontWeight: 600, fontSize: "0.9rem" }}>Drop your CSV / Excel file here, or click to browse</div>
                    <div style={{ fontSize: "0.78rem", color: "var(--q-text-4)", marginTop: 6 }}>
                      Expected columns: order id, date, time, customer, product, category, quantity, sales, cost/profit (names are auto-detected)
                    </div>
                  </>
                )}
              </label>

              {error && (
                <div style={{ marginTop: 16, padding: "10px 14px", background: "#FEF2F2", border: "1px solid #FCA5A5", borderRadius: 10, color: "#991B1B", fontSize: "0.875rem", display: "flex", gap: 8, alignItems: "flex-start" }}>
                  <AlertCircle size={16} style={{ flexShrink: 0, marginTop: 2 }} /> {error}
                </div>
              )}

              <div style={{ display: "flex", gap: 12, marginTop: 22 }}>
                <button className="q-btn q-btn-outline" onClick={() => router.push("/dashboard")} disabled={uploading}>
                  Skip for now
                </button>
                <button
                  className="q-btn q-btn-primary q-btn-lg" style={{ flex: 1, gap: 8 }}
                  onClick={uploadFile} disabled={!file || uploading}
                >
                  {uploading ? <Loader2 size={17} className="q-spin" /> : <UploadCloud size={17} />}
                  {uploading ? "Processing with ML pipeline…" : "Upload & Analyse"}
                </button>
              </div>
              {uploading && (
                <p style={{ fontSize: "0.78rem", color: "var(--q-text-4)", marginTop: 12, textAlign: "center" }}>
                  Records are stored first, then the full ML pipeline runs on your complete history. This can take up to a minute.
                </p>
              )}
            </>
          ) : (
            <div style={{ textAlign: "center", padding: "20px 0" }}>
              <CheckCircle2 size={44} color="#059669" style={{ marginBottom: 14 }} />
              <h2 style={{ fontWeight: 800, fontSize: "1.15rem", marginBottom: 8 }}>Analysis complete</h2>
              <p style={{ color: "var(--q-text-3)", fontSize: "0.88rem", marginBottom: 20 }}>
                {uploadResult.total_records ?? "—"} records processed
                {uploadResult.cleaned_records != null && ` (${uploadResult.cleaned_records} after cleaning)`}.
                Results are saved and will be waiting when you log in again.
              </p>
              <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
                <button className="q-btn q-btn-primary q-btn-lg" style={{ gap: 8 }} onClick={() => router.push("/dashboard")}>
                  Go to Dashboard
                </button>
                <button className="q-btn q-btn-outline q-btn-lg" onClick={() => router.push("/analytics/ml")}>
                  View ML Analytics
                </button>
                <button className="q-btn q-btn-ghost q-btn-lg" onClick={() => { setUploadResult(null); setFile(null); setStep(2); }}>
                  Upload another file
                </button>
              </div>
            </div>
          )}
        </div>

        <p style={{ fontSize: "0.78rem", color: "var(--q-text-4)", textAlign: "center", marginTop: 16, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
          <MapPin size={12} /> You can edit business details later in Profile / Settings.
        </p>
      </div>
    );
  }

  // ── Step 1: essentials only ────────────────────────────────────────────────
  return (
    <div className="q-page-shell" style={{ maxWidth: 720, margin: "0 auto" }}>
      <button onClick={() => router.back()} className="q-btn q-btn-ghost q-btn-sm" style={{ gap: 6, marginBottom: 20 }}>
        <ArrowLeft size={15} /> Back
      </button>

      <div style={{ marginBottom: 28 }}>
        <h1 className="q-page-title">Add Your Business</h1>
        <p className="q-page-subtitle">
          Just the essentials — you'll upload your sales data next, and can edit details later.
        </p>
      </div>

      <form onSubmit={createBusiness} className="q-card" style={{ padding: 28 }}>
        <div style={{ marginBottom: 24 }}>
          <label style={labelStyle}>Business Type *</label>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            {BUSINESS_TYPES.map((t) => {
              const Icon = t.icon;
              const active = form.businessType === t.id;
              return (
                <button
                  type="button" key={t.id}
                  onClick={() => setForm((p) => ({ ...p, businessType: t.id }))}
                  style={{
                    padding: "18px 16px", borderRadius: 12, cursor: "pointer",
                    border: `2px solid ${active ? t.color : "var(--q-border)"}`,
                    background: active ? t.color + "10" : "var(--q-surface-2)",
                    fontFamily: "inherit", textAlign: "left", transition: "all 0.15s",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
                    <Icon size={20} style={{ color: active ? t.color : "var(--q-text-4)" }} />
                    <span style={{ fontWeight: 700, fontSize: "0.95rem", color: active ? t.color : "var(--q-text-1)" }}>{t.label}</span>
                  </div>
                  <div style={{ fontSize: "0.78rem", color: "var(--q-text-4)", lineHeight: 1.5 }}>{t.desc}</div>
                </button>
              );
            })}
          </div>
        </div>

        <div style={{ marginBottom: 20 }}>
          <label style={labelStyle}>Business Name *</label>
          <div style={{ position: "relative" }}>
            <Store size={15} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--q-text-4)" }} />
            <input style={{ ...inputStyle, paddingLeft: 36 }} placeholder="e.g. Angry Oven" value={form.businessName} onChange={set("businessName")} />
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14, marginBottom: 24 }}>
          <div>
            <label style={labelStyle}>Country</label>
            <select style={inputStyle} value={form.country} onChange={set("country")}>
              <option value="">Select…</option>
              {COUNTRIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label style={labelStyle}>State</label>
            <input style={inputStyle} placeholder="State" value={form.state} onChange={set("state")} />
          </div>
          <div>
            <label style={labelStyle}>City</label>
            <input style={inputStyle} placeholder="City" value={form.city} onChange={set("city")} />
          </div>
        </div>

        {error && (
          <div style={{ padding: "10px 14px", background: "#FEF2F2", border: "1px solid #FCA5A5", borderRadius: 10, color: "#991B1B", fontSize: "0.875rem", marginBottom: 16, display: "flex", gap: 8, alignItems: "flex-start" }}>
            <AlertCircle size={16} style={{ flexShrink: 0, marginTop: 2 }} /> {error}
          </div>
        )}

        <button type="submit" disabled={loading} className="q-btn q-btn-primary q-btn-lg" style={{ width: "100%", gap: 8 }}>
          {loading ? <Loader2 size={17} className="q-spin" /> : <Store size={17} />}
          {loading ? "Creating…" : "Continue to Data Upload"}
        </button>
      </form>
    </div>
  );
}
