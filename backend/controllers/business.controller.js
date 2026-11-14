/**
 * business.controller.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Handles all /api/businesses routes.
 *
 * Endpoints
 *   POST   /api/businesses            → createBusiness
 *   GET    /api/businesses            → getUserBusinesses
 *   GET    /api/businesses/:id        → getBusinessById
 *   GET    /api/businesses/:id/metrics→ getBusinessMetrics   ← KPI dashboard
 *   POST   /api/businesses/upload     → uploadBusinessFile
 *   PUT    /api/businesses/:id        → updateBusiness
 *   PATCH  /api/businesses/:id        → patchBusiness
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { Op, fn, col, literal } from "sequelize";
import Business        from "../models/business.model.js";
import Sale            from "../models/sale.model.js";
import Customer        from "../models/customer.model.js";
import { Expense }     from "../models/expense.model.js";
import FinancialHistory from "../models/financialHistory.model.js";
import BusinessMetric  from "../models/businessMetric.model.js";
import { parseFile }   from "../services/fileParser.service.js";

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/** Standard success envelope */
const ok = (res, data, status = 200) =>
  res.status(status).json({ success: true, ...data });

/** Standard error envelope */
const fail = (res, message, status = 400) =>
  res.status(status).json({ success: false, message });

/** Wraps async handlers — eliminates repetitive try/catch blocks */
const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch((err) => {
    console.error(`[Business Error] ${req.method} ${req.originalUrl}:`, err.message);
    return fail(res, err.message || "Internal server error.", 500);
  });

/** Fields that can be set on create/update */
const WRITABLE_FIELDS = [
  "businessName", "brandName", "industry", "stage",
  "description", "targetAudience", "problemStatement",
  "solution", "uniqueValueProposition",
  "businessType", "businessModel", "operatingModel",
  "country", "state", "city", "pincode", "currency",
  "website", "employeeCount",
];

/** Converts a DECIMAL string from Sequelize to a rounded Number (or 0) */
const toNum = (v) => Math.round(Number(v ?? 0) * 100) / 100;

/**
 * Build last-12-months date boundaries.
 * Returns { startDate, endDate } as Date objects.
 */
const last12Months = () => {
  const end   = new Date();
  const start = new Date();
  start.setMonth(start.getMonth() - 11);
  start.setDate(1);
  start.setHours(0, 0, 0, 0);
  return { startDate: start, endDate: end };
};

// ─────────────────────────────────────────────────────────────────────────────
// GUARD — ensure business belongs to the authenticated user
// ─────────────────────────────────────────────────────────────────────────────
const findOwnedBusiness = async (businessId, userId) => {
  const business = await Business.findOne({
    where: { id: businessId, userId },
  });
  return business; // null = not found / not owned
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/businesses   — Create a new business
// ─────────────────────────────────────────────────────────────────────────────
export const createBusiness = asyncHandler(async (req, res) => {
  const { businessName } = req.body;

  if (!businessName?.trim()) {
    return fail(res, "businessName is required.", 422);
  }

  const payload = { userId: req.user.id };
  for (const field of WRITABLE_FIELDS) {
    if (req.body[field] !== undefined) payload[field] = req.body[field];
  }

  const business = await Business.create(payload);

  return ok(res, { business }, 201);
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/businesses   — List all businesses for the logged-in user
// ─────────────────────────────────────────────────────────────────────────────
export const getUserBusinesses = asyncHandler(async (req, res) => {
  const businesses = await Business.findAll({
    where:  { userId: req.user.id },
    order:  [["createdAt", "DESC"]],
    attributes: { exclude: ["pdfDetails"] }, // keep list lightweight
  });

  return ok(res, { count: businesses.length, businesses });
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/businesses/:id   — Single business detail
// ─────────────────────────────────────────────────────────────────────────────
export const getBusinessById = asyncHandler(async (req, res) => {
  const business = await findOwnedBusiness(req.params.id, req.user.id);
  if (!business) return fail(res, "Business not found.", 404);

  return ok(res, { business });
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/businesses/:id/metrics   — Dashboard KPI card data
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Priority order for KPI values:
 *   1. Real transactional data  (sales, customers, expenses tables)
 *   2. Financial history rows   (manually entered / onboarding data)
 *   3. Business-metric snapshot (entered during onboarding)
 *   4. Parsed upload (pdfDetails JSON)
 *   5. Zeros / nulls
 */
export const getBusinessMetrics = asyncHandler(async (req, res) => {
  const businessId = req.params.id;
  const business   = await findOwnedBusiness(businessId, req.user.id);
  if (!business) return fail(res, "Business not found.", 404);

  const { startDate, endDate } = last12Months();
  const dateFilter = { orderDate: { [Op.between]: [startDate, endDate] } };

  // ── 1. Aggregate from Sales table ────────────────────────────────────────
  const [salesAgg] = await Sale.findAll({
    where:      { businessId, ...dateFilter },
    attributes: [
      [fn("COALESCE", fn("SUM", col("totalAmount")),  0), "revenue"],
      [fn("COALESCE", fn("SUM", col("profitAmount")), 0), "profit"],
      [fn("COUNT",    col("id")),                         "orderCount"],
    ],
    raw: true,
  });

  const salesRevenue    = toNum(salesAgg?.revenue);
  const salesProfit     = toNum(salesAgg?.profit);
  const salesOrderCount = Number(salesAgg?.orderCount ?? 0);

  // ── 2. Customer counts ───────────────────────────────────────────────────
  const totalCustomers = await Customer.count({ where: { businessId } });

  // New customers in the last 30 days
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const newCustomers = await Customer.count({
    where: { businessId, createdAt: { [Op.gte]: thirtyDaysAgo } },
  });

  // ── 3. Total expenses (last 12 months) ──────────────────────────────────
  const [expAgg] = await Expense.findAll({
    where: {
      businessId,
      expenseDate: { [Op.between]: [startDate, endDate] },
    },
    attributes: [[fn("COALESCE", fn("SUM", col("amount")), 0), "totalExpenses"]],
    raw: true,
  });
  const totalExpenses = toNum(expAgg?.totalExpenses);

  // ── 4. Financial history (most recent period) ────────────────────────────
  const latestFinHistory = await FinancialHistory.findOne({
    where:  { businessId },
    order:  [["periodEnd", "DESC"]],
  });

  // Prefer real sales data; fall back to financial history
  const revenue    = salesRevenue    || toNum(latestFinHistory?.revenue);
  const netProfit  = salesProfit     || toNum(latestFinHistory?.netProfit);
  const grossProfit               = toNum(latestFinHistory?.grossProfit);
  const cogs                      = toNum(latestFinHistory?.cogs);
  const operatingExpenses         = toNum(latestFinHistory?.operatingExpenses)
                                    || totalExpenses;
  const marketingSpend            = toNum(latestFinHistory?.marketingSpend);

  // ── 5. Business metric snapshot (CAC, LTV, churn from onboarding) ───────
  const bizMetric = await BusinessMetric.findOne({
    where: { businessId },
    order: [["createdAt", "DESC"]],
  });

  const churnRate         = bizMetric?.churnRate         ? Number(bizMetric.churnRate)         : null;
  const cac               = bizMetric?.cac               ? Number(bizMetric.cac)               : null;
  const ltv               = bizMetric?.ltv               ? Number(bizMetric.ltv)               : null;
  const revenueGrowthRate = bizMetric?.revenueGrowthRate ? Number(bizMetric.revenueGrowthRate) : null;

  // ── 6. Revenue chart — last 12 months from FinancialHistory ─────────────
  const finHistoryRows = await FinancialHistory.findAll({
    where: {
      businessId,
      periodEnd: { [Op.gte]: startDate },
    },
    order:  [["periodEnd", "ASC"]],
    attributes: ["periodStart", "periodEnd", "periodType", "revenue", "netProfit", "operatingExpenses"],
  });

  const revenueChart = finHistoryRows.map((r) => ({
    period:   r.periodEnd,
    revenue:  toNum(r.revenue),
    profit:   toNum(r.netProfit),
    expenses: toNum(r.operatingExpenses),
  }));

  // ── 7. Monthly sales chart from Sale table (last 12 months) ─────────────
  const monthlySales = await Sale.findAll({
    where:   { businessId, ...dateFilter },
    attributes: [
      [fn("DATE_TRUNC", "month", col("orderDate")), "month"],
      [fn("COALESCE", fn("SUM", col("totalAmount")),  0), "revenue"],
      [fn("COALESCE", fn("SUM", col("profitAmount")), 0), "profit"],
      [fn("COUNT", col("id")), "orders"],
    ],
    group: [fn("DATE_TRUNC", "month", col("orderDate"))],
    order: [[fn("DATE_TRUNC", "month", col("orderDate")), "ASC"]],
    raw: true,
  });

  const salesChart = monthlySales.map((r) => ({
    month:   r.month,
    revenue: toNum(r.revenue),
    profit:  toNum(r.profit),
    orders:  Number(r.orders),
  }));

  // ── 8. Health score (0–100) ──────────────────────────────────────────────
  let healthScore = 0;
  const hasData   = revenue > 0 || totalCustomers > 0 || salesOrderCount > 0;

  if (hasData) {
    healthScore = 40; // base — they have data

    // Revenue present
    if (revenue > 0)       healthScore += 15;

    // Profitable
    if (netProfit > 0)     healthScore += 15;

    // Has customers
    if (totalCustomers > 0) healthScore += 10;

    // Low churn (< 5 %)
    if (churnRate !== null && churnRate < 5) healthScore += 10;

    // Growing (positive growth rate)
    if (revenueGrowthRate !== null && revenueGrowthRate > 0) healthScore += 10;

    healthScore = Math.min(healthScore, 100);
  }

  // ── 9. Smart alerts ──────────────────────────────────────────────────────
  const alerts = [];
  if (churnRate !== null && churnRate >= 10) {
    alerts.push({ type: "warning", message: `High churn rate: ${churnRate}%. Consider a retention campaign.` });
  }
  if (netProfit < 0 && revenue > 0) {
    alerts.push({ type: "danger",  message: "Business is operating at a net loss. Review expense structure." });
  }
  if (totalCustomers === 0) {
    alerts.push({ type: "info",    message: "No customers recorded yet. Add customer data to unlock insights." });
  }
  if (!business.onboardingDone) {
    alerts.push({ type: "info",    message: "Complete onboarding to unlock full AI-powered insights." });
  }

  // ── Final response ───────────────────────────────────────────────────────
  return ok(res, {
    meta: {
      businessId:      business.id,
      businessName:    business.businessName,
      industry:        business.industry,
      stage:           business.stage,
      currency:        business.currency || "USD",
      operatingModel:  business.operatingModel,
      onboardingDone:  business.onboardingDone,
      hasUploadedFile: !!business.uploadedFile,
    },
    kpis: {
      revenue,
      netProfit,
      grossProfit,
      cogs,
      operatingExpenses,
      marketingSpend,
      totalExpenses,
      // Customer KPIs
      totalCustomers,
      newCustomers,
      salesOrderCount,
      // Metric snapshots
      churnRate,
      cac,
      ltv,
      revenueGrowthRate,
      // Composite
      healthScore,
    },
    charts: {
      // Use salesChart when sales data exists, else fall back to finHistory rows
      revenue: salesChart.length > 0 ? salesChart : revenueChart,
    },
    alerts,
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/businesses/upload   — Upload & parse a business data file
// ─────────────────────────────────────────────────────────────────────────────
export const uploadBusinessFile = asyncHandler(async (req, res) => {
  if (!req.file) {
    return fail(res, "No file uploaded. Send a multipart/form-data request with field 'file'.", 422);
  }

  const { businessId } = req.body;
  const filePath = req.file.path;

  // Parse file content (Excel / CSV / PDF)
  let extractedData = null;
  try {
    extractedData = await parseFile(filePath);
  } catch (parseErr) {
    console.warn("[Upload] File parse warning:", parseErr.message);
  }

  // Persist parsed data to the business record (if businessId provided)
  let updatedBusiness = null;
  if (businessId) {
    const business = await findOwnedBusiness(businessId, req.user.id);
    if (!business) return fail(res, "Business not found.", 404);

    await business.update({
      pdfDetails:   extractedData ?? null,
      uploadedFile: req.file.filename,
    });
    updatedBusiness = business;
  }

  return ok(res, {
    message: "File uploaded and parsed successfully.",
    file: {
      originalName: req.file.originalname,
      filename:     req.file.filename,
      mimetype:     req.file.mimetype,
      sizeBytes:    req.file.size,
      url:          `/uploads/${req.file.filename}`,
    },
    extractedData: extractedData ?? null,
    business:      updatedBusiness,
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// PUT /api/businesses/:id   — Full update (all writable fields must be sent)
// ─────────────────────────────────────────────────────────────────────────────
export const updateBusiness = asyncHandler(async (req, res) => {
  const business = await findOwnedBusiness(req.params.id, req.user.id);
  if (!business) return fail(res, "Business not found.", 404);

  const { businessName } = req.body;
  if (!businessName?.trim()) {
    return fail(res, "businessName is required for a full update.", 422);
  }

  // Full replace — set every writable field (null for omitted ones)
  const updateData = {};
  for (const field of WRITABLE_FIELDS) {
    updateData[field] = req.body[field] ?? null;
  }

  await business.update(updateData);
  return ok(res, { business });
});

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/businesses/:id   — Partial update (only send fields to change)
// ─────────────────────────────────────────────────────────────────────────────
export const patchBusiness = asyncHandler(async (req, res) => {
  const business = await findOwnedBusiness(req.params.id, req.user.id);
  if (!business) return fail(res, "Business not found.", 404);

  // Only apply fields that are explicitly present in the request body
  const updateData = {};
  for (const field of WRITABLE_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(req.body, field)) {
      updateData[field] = req.body[field];
    }
  }

  if (Object.keys(updateData).length === 0) {
    return fail(res, "No valid fields provided to update.", 422);
  }

  await business.update(updateData);
  return ok(res, { business });
});

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /api/businesses/:id   — Permanently delete a business (owner only)
// ─────────────────────────────────────────────────────────────────────────────
export const deleteBusiness = asyncHandler(async (req, res) => {
  const business = await findOwnedBusiness(req.params.id, req.user.id);
  if (!business) return fail(res, "Business not found.", 404);

  await business.destroy();

  // 204 No Content — success with no body
  return res.status(204).send();
});

