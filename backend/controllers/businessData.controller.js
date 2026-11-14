/**
 * businessData.controller.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Endpoints for accumulated business data:
 *   GET  /api/businesses/:id/imports      Import history + record stats
 *   GET  /api/businesses/:id/customers    Customer analytics (real records)
 *   GET  /api/businesses/:id/products     Product/menu analytics
 *   POST /api/businesses/:id/simulate     Decision simulator (what-if)
 *   GET  /api/businesses/:id/competitors  Nearby restaurants/cafes (OSM)
 * ─────────────────────────────────────────────────────────────────────────────
 */

import Business from "../models/business.model.js";
import BusinessRecord from "../models/businessRecord.model.js";
import { Op } from "sequelize";
import { getRecordStats } from "../services/businessData.service.js";

const ok = (res, data, status = 200) =>
  res.status(status).json({ success: true, ...data });

const fail = (res, message, status = 400) =>
  res.status(status).json({ success: false, message });

const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch((err) => {
    console.error(`[BizData Error] ${req.method} ${req.originalUrl}:`, err.message);
    return fail(res, err.message || "Internal server error.", 500);
  });

const findOwnedBusiness = async (businessId, userId) =>
  Business.findOne({ where: { id: businessId, userId } });

const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

// ── GET /:id/imports ─────────────────────────────────────────────────────────
export const getImports = asyncHandler(async (req, res) => {
  const business = await findOwnedBusiness(req.params.id, req.user.id);
  if (!business) return fail(res, "Business not found.", 404);
  return ok(res, await getRecordStats(business.id, req.user.id));
});

// ── GET /:id/customers ───────────────────────────────────────────────────────
export const getCustomers = asyncHandler(async (req, res) => {
  const business = await findOwnedBusiness(req.params.id, req.user.id);
  if (!business) return fail(res, "Business not found.", 404);
  const { id: businessId, userId } = { id: business.id, userId: req.user.id };

  const rows = await BusinessRecord.findAll({
    where: { businessId, userId, customerId: { [Op.ne]: null } },
    attributes: [
      "customerId",
      [BusinessRecord.sequelize.fn("COUNT", BusinessRecord.sequelize.fn("DISTINCT", BusinessRecord.sequelize.col("orderId"))), "orders"],
      [BusinessRecord.sequelize.fn("SUM", BusinessRecord.sequelize.col("sales")), "totalSales"],
      [BusinessRecord.sequelize.fn("MIN", BusinessRecord.sequelize.col("orderDate")), "firstOrder"],
      [BusinessRecord.sequelize.fn("MAX", BusinessRecord.sequelize.col("orderDate")), "lastOrder"],
    ],
    group: ["customerId"],
    raw: true,
  });

  const walkInOrders = await BusinessRecord.count({
    where: { businessId, userId, customerId: { [Op.iLike]: "%walk%" } },
    distinct: true,
    col: "orderId",
  });

  const customers = rows
    .filter((c) => c.customerId && !/walk/i.test(String(c.customerId)))
    .map((c) => ({
      customerId: c.customerId,
      orders: num(c.orders),
      totalSales: num(c.totalSales),
      firstOrder: c.firstOrder,
      lastOrder: c.lastOrder,
      avgOrderValue: num(c.orders) ? num(c.totalSales) / num(c.orders) : 0,
    }));

  const totalOrders = customers.reduce((s, c) => s + c.orders, 0);
  const totalSales = customers.reduce((s, c) => s + c.totalSales, 0);
  const repeatCustomers = customers.filter((c) => c.orders > 1).length;
  const avgSpend = totalSales / Math.max(customers.length, 1);

  const segmented = customers.map((c) => {
    let segment = "Occasional";
    if (c.orders >= 5 && c.totalSales >= avgSpend * 2) segment = "VIP";
    else if (c.orders >= 3 || c.totalSales >= avgSpend) segment = "Regular";
    else if (c.orders === 1) segment = "New";
    return { ...c, segment };
  });

  const segCount = (s) => segmented.filter((c) => c.segment === s).length;

  return ok(res, {
    totalCustomers: customers.length,
    totalOrders,
    totalSales,
    repeatCustomers,
    repeatRatePct: customers.length ? Math.round((repeatCustomers / customers.length) * 1000) / 10 : null,
    avgOrdersPerCustomer: customers.length ? Math.round((totalOrders / customers.length) * 100) / 100 : null,
    avgSpendPerCustomer: Math.round(avgSpend * 100) / 100,
    walkInOrders: num(walkInOrders),
    segments: {
      VIP: segCount("VIP"),
      Regular: segCount("Regular"),
      Occasional: segCount("Occasional"),
      New: segCount("New"),
    },
    customers: segmented.sort((a, b) => b.totalSales - a.totalSales).slice(0, 200),
  });
});

// ── GET /:id/products ────────────────────────────────────────────────────────
export const getProducts = asyncHandler(async (req, res) => {
  const business = await findOwnedBusiness(req.params.id, req.user.id);
  if (!business) return fail(res, "Business not found.", 404);
  const businessId = business.id;
  const userId = req.user.id;

  const productExpr = BusinessRecord.sequelize.fn(
    "COALESCE",
    BusinessRecord.sequelize.col("productName"),
    BusinessRecord.sequelize.col("productId"),
    "Unknown"
  );

  const rows = await BusinessRecord.findAll({
    where: { businessId, userId },
    attributes: [
      [productExpr, "product"],
      "productId",
      "category",
      [BusinessRecord.sequelize.fn("SUM", BusinessRecord.sequelize.col("quantity")), "quantity"],
      [BusinessRecord.sequelize.fn("SUM", BusinessRecord.sequelize.col("sales")), "sales"],
      [BusinessRecord.sequelize.fn("SUM", BusinessRecord.sequelize.col("cost")), "cost"],
      [BusinessRecord.sequelize.fn("SUM", BusinessRecord.sequelize.col("profit")), "profit"],
      [BusinessRecord.sequelize.fn("COUNT", BusinessRecord.sequelize.fn("DISTINCT", BusinessRecord.sequelize.col("orderId"))), "orders"],
      [BusinessRecord.sequelize.fn("MIN", BusinessRecord.sequelize.col("orderDate")), "firstSold"],
      [BusinessRecord.sequelize.fn("MAX", BusinessRecord.sequelize.col("orderDate")), "lastSold"],
    ],
    group: [productExpr, "productId", "category"],
    raw: true,
  });

  const products = rows.map((r) => {
    const sales = num(r.sales);
    const cost = r.cost != null ? num(r.cost) : null;
    const profit = r.profit != null ? num(r.profit) : (cost != null ? sales - cost : null);
    return {
      product: r.product,
      sku: r.productId,
      category: r.category,
      quantity: num(r.quantity),
      orders: num(r.orders),
      sales,
      cost,
      profit,
      marginPct: sales ? Math.round(((profit ?? 0) / sales) * 1000) / 10 : null,
      firstSold: r.firstSold,
      lastSold: r.lastSold,
    };
  });

  const totalSales = products.reduce((s, p) => s + p.sales, 0);
  const catMap = {};
  for (const p of products) {
    const c = p.category || "Uncategorized";
    catMap[c] = catMap[c] || { category: c, products: 0, sales: 0, quantity: 0 };
    catMap[c].products += 1;
    catMap[c].sales += p.sales;
    catMap[c].quantity += p.quantity;
  }

  return ok(res, {
    totalProducts: products.length,
    totalSales,
    products: products.sort((a, b) => b.sales - a.sales),
    categories: Object.values(catMap)
      .map((c) => ({ ...c, sharePct: totalSales ? Math.round((c.sales / totalSales) * 1000) / 10 : null }))
      .sort((a, b) => b.sales - a.sales),
  });
});

// ── POST /:id/simulate ───────────────────────────────────────────────────────
export const simulateScenario = asyncHandler(async (req, res) => {
  const business = await findOwnedBusiness(req.params.id, req.user.id);
  if (!business) return fail(res, "Business not found.", 404);
  const businessId = business.id;
  const userId = req.user.id;

  const {
    priceChangePct = 0,
    discountPct = 0,
    marketingSpend = 0,
    costChangePct = 0,
    days = 30,
  } = req.body || {};

  const since = new Date(Date.now() - 90 * 86400000).toISOString().slice(0, 10);
  const [agg] = await BusinessRecord.findAll({
    where: { businessId, userId, orderDate: { [Op.gte]: since } },
    attributes: [
      [BusinessRecord.sequelize.fn("COUNT", BusinessRecord.sequelize.fn("DISTINCT", BusinessRecord.sequelize.col("orderId"))), "orders"],
      [BusinessRecord.sequelize.fn("SUM", BusinessRecord.sequelize.col("sales")), "sales"],
      [BusinessRecord.sequelize.fn("SUM", BusinessRecord.sequelize.col("cost")), "cost"],
      [BusinessRecord.sequelize.fn("COUNT", BusinessRecord.sequelize.fn("DISTINCT", BusinessRecord.sequelize.col("customerId"))), "customers"],
    ],
    raw: true,
  });

  const totalOrders = num(agg?.orders);
  const totalSales = num(agg?.sales);
  const totalCost = agg?.cost != null ? num(agg.cost) : null;

  if (totalOrders === 0) {
    return ok(res, {
      hasBaseline: false,
      message: "Not enough historical data to simulate — upload sales data first.",
    });
  }

  const windowDays = Math.max(1, Math.round((Date.now() - new Date(since).getTime()) / 86400000));
  const horizon = Math.max(1, num(days) || 30);
  const scale = horizon / windowDays;

  const baseDailyOrders = totalOrders / windowDays;
  const baseAov = totalSales / totalOrders;
  const baseMargin = totalCost != null && totalSales ? (totalSales - totalCost) / totalSales : null;

  // Documented heuristic assumptions (shown to the user in the UI):
  //  price elasticity ≈ -0.8; discount lifts volume ~0.6x its depth;
  //  marketing assumed at 4x ROAS; cost changes pass through 1:1 to COGS.
  const priceFactor = 1 + num(priceChangePct) / 100;
  const volumeFactor = Math.max(0.2, 1 + -0.8 * (num(priceChangePct) / 100));
  const discountFactor = 1 + Math.max(0, num(discountPct)) / 100 * 0.6;

  const simOrders = Math.round(baseDailyOrders * volumeFactor * discountFactor * horizon);
  const simAov = baseAov * priceFactor * (1 - Math.max(0, num(discountPct)) / 100);
  const simRevenue = simOrders * simAov;
  const simRevenueWithMarketing = simRevenue + num(marketingSpend) * 4;

  const simCogs = totalCost != null
    ? totalCost * scale * volumeFactor * discountFactor * (1 + num(costChangePct) / 100)
    : null;
  const simProfit = simCogs != null ? simRevenueWithMarketing - simCogs : null;
  const simMarginPct = simProfit != null && simRevenueWithMarketing
    ? Math.round((simProfit / simRevenueWithMarketing) * 1000) / 10
    : null;

  const baseRevenue = baseDailyOrders * baseAov * horizon;
  const baseProfit = totalCost != null ? baseRevenue * (baseMargin ?? 0) : null;

  return ok(res, {
    hasBaseline: true,
    currency: business.currency || "USD",
    assumptions: {
      elasticityUsed: -0.8,
      marketingROAS: 4,
      windowDays,
      baselineOrders: totalOrders,
      baselineAov: Math.round(baseAov * 100) / 100,
      baselineMarginPct: baseMargin != null ? Math.round(baseMargin * 1000) / 10 : null,
    },
    scenario: {
      priceChangePct: num(priceChangePct),
      discountPct: num(discountPct),
      marketingSpend: num(marketingSpend),
      costChangePct: num(costChangePct),
      days: horizon,
    },
    baseline: {
      orders: Math.round(baseDailyOrders * horizon),
      revenue: Math.round(baseRevenue * 100) / 100,
      profit: baseProfit != null ? Math.round(baseProfit * 100) / 100 : null,
      marginPct: baseMargin != null ? Math.round(baseMargin * 1000) / 10 : null,
    },
    simulated: {
      orders: simOrders,
      aov: Math.round(simAov * 100) / 100,
      revenue: Math.round(simRevenueWithMarketing * 100) / 100,
      cogs: simCogs != null ? Math.round(simCogs * 100) / 100 : null,
      profit: simProfit != null ? Math.round(simProfit * 100) / 100 : null,
      marginPct: simMarginPct,
      isSimulation: true,
    },
    deltas: {
      revenuePct: baseRevenue ? Math.round(((simRevenueWithMarketing - baseRevenue) / baseRevenue) * 1000) / 10 : null,
      profitPct: baseProfit && simProfit != null ? Math.round(((simProfit - baseProfit) / baseProfit) * 1000) / 10 : null,
      ordersPct: baseDailyOrders * horizon ? Math.round(((simOrders - baseDailyOrders * horizon) / (baseDailyOrders * horizon)) * 1000) / 10 : null,
    },
  });
});

// ── GET /:id/competitors ─────────────────────────────────────────────────────
function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Competitor results are cached per business for 24h — Overpass public
// instances are slow/rate-limited, and map data does not change minute-to-minute.
const COMPETITOR_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const competitorCache = new Map(); // businessId → { expiresAt, payload }

export const getCompetitors = asyncHandler(async (req, res) => {
  const business = await findOwnedBusiness(req.params.id, req.user.id);
  if (!business) return fail(res, "Business not found.", 404);

  const cached = competitorCache.get(business.id);
  if (cached && cached.expiresAt > Date.now()) {
    return ok(res, { ...cached.payload, cached: true });
  }

  const { city, state, country, businessName } = business;
  if (!city) {
    return ok(res, {
      hasLocation: false,
      message: "Add your city/state/country in business settings to find nearby competitors.",
      competitors: [],
    });
  }

  const axios = (await import("axios")).default;
  const query = [city, state, country].filter(Boolean).join(", ");
  const fetchedAt = new Date().toISOString();

  try {
    const geo = await axios.get("https://nominatim.openstreetmap.org/search", {
      params: { q: query, format: "json", limit: 1 },
      headers: { "User-Agent": "Quantora/1.0 (business dashboard)" },
      timeout: 10000,
    });
    if (!geo.data?.length) {
      return ok(res, {
        hasLocation: true,
        message: `Could not locate "${query}" on OpenStreetMap.`,
        competitors: [],
        source: "OpenStreetMap",
        fetchedAt,
      });
    }
    const { lat, lon, display_name } = geo.data[0];

    // Node-only query first — it is dramatically faster on busy Overpass
    // instances. Only if it yields nothing do we pay for the way-inclusive
    // query (building outlines), which is what usually times out.
    const nodeQuery = `
      [out:json][timeout:40];
      node["amenity"~"^(restaurant|cafe)$"](around:10000,${lat},${lon});
      out center tags;
    `;
    const fullQuery = `
      [out:json][timeout:50];
      (
        node["amenity"="restaurant"](around:10000,${lat},${lon});
        node["amenity"="cafe"](around:10000,${lat},${lon});
        way["amenity"="restaurant"](around:10000,${lat},${lon});
        way["amenity"="cafe"](around:10000,${lat},${lon});
      );
      out center tags;
    `;
    const endpoints = [
      "https://overpass-api.de/api/interpreter",
      "https://overpass.kumi.systems/api/interpreter",
      "https://overpass.private.coffee/api/interpreter",
    ];
    const runQuery = async (ql) => {
      let lastErr = null;
      for (const url of endpoints) {
        try {
          const ov = await axios.post(
            url,
            `data=${encodeURIComponent(ql)}`,
            { headers: { "User-Agent": "Quantora/1.0 (business dashboard)" }, timeout: 90000 }
          );
          if (ov.data?.remark) throw new Error(ov.data.remark);
          return ov.data?.elements || [];
        } catch (e) {
          lastErr = e;
        }
      }
      throw lastErr;
    };

    let elements = [];
    try {
      elements = await runQuery(nodeQuery);
    } catch (e) {
      // node query failed on every mirror — try the full query once
      elements = await runQuery(fullQuery);
    }
    const hasNamed = elements.some((el) => (el.tags || {}).name);
    if (!hasNamed) {
      try {
        elements = await runQuery(fullQuery);
      } catch (_) {
        // keep node results (possibly empty) rather than failing outright
      }
    }
    const competitors = elements
      .map((el) => {
        const t = el.tags || {};
        const name = t.name || t["name:en"] || null;
        if (!name) return null;
        if (businessName && name.toLowerCase() === String(businessName).toLowerCase()) return null;
        const elat = el.lat ?? el.center?.lat;
        const elon = el.lon ?? el.center?.lon;
        const dist = elat != null ? haversineKm(lat, lon, elat, elon) : null;
        return {
          name,
          category: t.amenity === "cafe" ? "Cafe" : "Restaurant",
          cuisine: t.cuisine || null,
          address: [t["addr:housenumber"], t["addr:street"], t["addr:city"] || t["addr:suburb"]].filter(Boolean).join(" ") || null,
          distanceKm: dist != null ? Math.round(dist * 10) / 10 : null,
          osmType: el.type,
          osmId: el.id,
        };
      })
      .filter(Boolean)
      .sort((a, b) => (a.distanceKm ?? 999) - (b.distanceKm ?? 999))
      .slice(0, 25);

    const payload = {
      hasLocation: true,
      location: { query, lat, lon, displayName: display_name },
      count: competitors.length,
      competitors,
      source: "OpenStreetMap (Nominatim + Overpass API)",
      fetchedAt,
      note: "Public map data only — ratings, revenue and market share are not available from this source and are not estimated.",
    };
    competitorCache.set(business.id, { expiresAt: Date.now() + COMPETITOR_CACHE_TTL_MS, payload });
    return ok(res, payload);
  } catch (err) {
    return ok(res, {
      hasLocation: true,
      message: `Competitor lookup failed: ${err.message}. Try again later.`,
      competitors: [],
      source: "OpenStreetMap",
      fetchedAt,
    });
  }
});
