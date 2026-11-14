"use client";
/**
 * BusinessContext
 * ---------------
 * Single source of truth for the currently-selected business.
 * Extended to also fetch and expose ML analytics results from the
 * Python FastAPI pipeline (via Node.js /api/businesses/:id/ml-analytics).
 *
 * MODE:
 *   "demo"  → NovaMart demo data (only when user explicitly chose "Explore Demo")
 *   "real"  → live data fetched from backend for the selected business
 *   null    → no business selected yet (show onboarding / empty states)
 */

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from "react";
import API from "@/config/api";

const BusinessContext = createContext(null);

export function BusinessProvider({ children }) {
  const [mode, setMode] = useState(null);   // "demo" | "real" | null
  const [businesses, setBusinesses] = useState([]);     // list of user's businesses
  const [selected, setSelected] = useState(null);   // selected business object
  const [metrics, setMetrics] = useState(null);   // legacy KPI data (from /metrics)
  const [mlAnalytics, setMlAnalytics] = useState(null);   // ML pipeline results
  const [mlLoading, setMlLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // ── Fetch ML analytics for the selected business ───────────────────────────
  const fetchMLAnalytics = useCallback(async (businessId) => {
    if (!businessId || mode === "demo") return;
    setMlLoading(true);
    try {
      const res = await API.get(`/businesses/${businessId}/ml-analytics`);
      const data = res.data;
      if (data.hasMLData && data.mlResults) {
        setMlAnalytics(data);
      } else {
        setMlAnalytics({ hasMLData: false });
      }
    } catch {
      setMlAnalytics({ hasMLData: false });
    } finally {
      setMlLoading(false);
    }
  }, [mode]);

  // ── Fetch legacy metrics for the selected business ─────────────────────────
  const fetchMetrics = useCallback(async (businessId) => {
    if (!businessId || mode === "demo") return;
    setLoading(true);
    setError(null);
    try {
      const res = await API.get(`/businesses/${businessId}/metrics`);
      const body = res.data || {};
      const kpis = body.kpis || {};
      const charts = body.charts || {};
      const fmtMonth = (p) => {
        if (!p) return "";
        const d = new Date(p);
        return isNaN(d) ? String(p) : d.toLocaleDateString(undefined, { month: "short", year: "2-digit" });
      };
      setMetrics({
        revenue: kpis.revenue ?? null,
        netProfit: kpis.netProfit ?? null,
        profit: kpis.netProfit ?? null,
        customers: kpis.totalCustomers ?? null,
        churnRate: kpis.churnRate ?? null,
        healthScore: kpis.healthScore ?? null,
        revenueChart: (charts.revenue || []).map((c) => ({
          month: fmtMonth(c.period || c.month),
          revenue: c.revenue ?? 0,
          profit: c.profit ?? 0,
        })),
        customerChart: null,
        alerts: body.alerts || [],
        _meta: body.meta || null,
      });
    } catch {
      setMetrics({ _empty: true });
    } finally {
      setLoading(false);
    }
  }, [mode]);

  // ── Fetch user's businesses from backend ───────────────────────────────────
  const fetchBusinesses = useCallback(async () => {
    try {
      const token =
        localStorage.getItem("accessToken") || localStorage.getItem("token");
      if (!token) return;
      setLoading(true);
      const res = await API.get("/businesses");
      const list = res.data?.data || res.data?.businesses || res.data || [];
      const arr = Array.isArray(list) ? list : [];
      setBusinesses(arr);

      if (arr.length > 0 && mode !== "demo") {
        const savedBiz = localStorage.getItem("q_selected_business");
        let bizToSelect = arr[0];
        if (savedBiz) {
          try {
            const parsed = JSON.parse(savedBiz);
            const found = arr.find((b) => b.id === parsed.id);
            if (found) bizToSelect = found;
          } catch (_) { }
        }
        setSelected(bizToSelect);
        setMode("real");
      }
    } catch {
      setBusinesses([]);
    } finally {
      setLoading(false);
    }
  }, [mode]);

  // ── Bootstrap from localStorage ───────────────────────────────────────────
  useEffect(() => {
    // Demo mode is disabled for real-user flows — always load real businesses.
    localStorage.removeItem("q_mode");
    fetchBusinesses();
  }, []);

  // ── Fetch metrics + ML analytics when selected business changes ───────────
  useEffect(() => {
    if (selected?.id && mode === "real") {
      fetchMetrics(selected.id);
      fetchMLAnalytics(selected.id);
    }
    if (selected) {
      localStorage.setItem("q_selected_business", JSON.stringify(selected));
    }
  }, [selected?.id, mode]);

  const enterDemoMode = () => {
    localStorage.setItem("q_mode", "demo");
    setMode("demo");
    setSelected(NOVAMART_DEMO);
    setMetrics(NOVAMART_METRICS);
    setMlAnalytics({ hasMLData: false });
  };

  const exitDemoMode = () => {
    localStorage.removeItem("q_mode");
    localStorage.removeItem("q_selected_business");
    setMode(null);
    setSelected(null);
    setMetrics(null);
    setMlAnalytics(null);
    fetchBusinesses();
  };

  const selectBusiness = (biz) => {
    setSelected(biz);
    setMode("real");
    setMetrics(null);
    setMlAnalytics(null);
  };

  const addBusiness = (biz) => {
    setBusinesses((prev) => [biz, ...prev]);
    selectBusiness(biz);
  };

  /** Call after uploading a dataset to refresh both metrics and ML results */
  const refreshMetrics = useCallback(() => {
    if (selected?.id && mode === "real") {
      fetchMetrics(selected.id);
      fetchMLAnalytics(selected.id);
    }
  }, [selected?.id, mode, fetchMetrics, fetchMLAnalytics]);

  /** Convenience: trigger only ML analytics refresh */
  const refreshMLAnalytics = useCallback(() => {
    if (selected?.id && mode === "real") {
      fetchMLAnalytics(selected.id);
    }
  }, [selected?.id, mode, fetchMLAnalytics]);

  const isDemo = mode === "demo";
  const businessName = isDemo
    ? "NovaMart (Demo)"
    : selected?.businessName || selected?.name || null;

  // hasData: true if we have actual numeric metrics
  const hasData = isDemo
    ? true
    : metrics !== null &&
    !metrics?._empty &&
    (metrics?.revenue != null ||
      metrics?.customers != null ||
      metrics?.healthScore != null);

  // hasMLData: true if real ML pipeline results exist for this business
  const hasMLData =
    !isDemo && mlAnalytics?.hasMLData === true && mlAnalytics?.mlResults != null;

  return (
    <BusinessContext.Provider
      value={{
        mode,
        isDemo,
        businesses,
        selected,
        metrics,
        mlAnalytics,
        mlLoading,
        loading,
        error,
        businessName,
        hasData,
        hasMLData,
        enterDemoMode,
        exitDemoMode,
        selectBusiness,
        addBusiness,
        fetchBusinesses,
        fetchMetrics,
        fetchMLAnalytics,
        refreshMetrics,
        refreshMLAnalytics,
      }}
    >
      {children}
    </BusinessContext.Provider>
  );
}

export const useBusiness = () => {
  const ctx = useContext(BusinessContext);
  if (!ctx) throw new Error("useBusiness must be used inside BusinessProvider");
  return ctx;
};


// ── NovaMart demo snapshot (ONLY used in demo mode) ─────────────────────────
export const NOVAMART_DEMO = {
  id: "demo",
  businessName: "NovaMart (Demo)",
  industry: "E-commerce",
  type: "B2C",
  country: "India",
  size: "11–50 people",
};

export const NOVAMART_METRICS = {
  revenue: 1240000,
  revenueLabel: "₹12.4L",
  revenueDelta: "+14.2%",
  profit: 320000,
  profitLabel: "₹3.2L",
  profitDelta: "+9.4%",
  customers: 8420,
  customersDelta: "+6.8%",
  churnRate: 4.2,
  healthScore: 82,
  revenueChart: [
    { month: "Apr", revenue: 820, profit: 210 },
    { month: "May", revenue: 940, profit: 250 },
    { month: "Jun", revenue: 890, profit: 230 },
    { month: "Jul", revenue: 1050, profit: 280 },
    { month: "Aug", revenue: 1180, profit: 310 },
    { month: "Sep", revenue: 1240, profit: 320 },
  ],
  customerChart: [
    { month: "Apr", new: 340, returning: 510, churned: 42 },
    { month: "May", new: 380, returning: 560, churned: 38 },
    { month: "Jun", new: 310, returning: 590, churned: 51 },
    { month: "Jul", new: 420, returning: 610, churned: 35 },
    { month: "Aug", new: 460, returning: 650, churned: 44 },
    { month: "Sep", new: 480, returning: 630, churned: 49 },
  ],
  alerts: [
    { id: 1, severity: "high", title: "Revenue Declined Last 2 Weeks", body: "Revenue decreased 8.4% in the last 14 days.", impact: "High" },
    { id: 2, severity: "medium", title: "Marketing ROI Falling", body: "ROAS declined from 4.2x to 3.1x.", impact: "Medium" },
    { id: 3, severity: "high", title: "High-Value Customers At Risk", body: "43 customers show declining activity.", impact: "High" },
  ],
};
