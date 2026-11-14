/**
 * onboarding.controller.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Handles the multi-step business onboarding wizard.
 *
 * Step map
 *  1  POST   /api/onboarding/start                  → Create / resume business
 *  2  PATCH  /api/onboarding/:id/operating-model    → Save operating model
 *  3  POST   /api/onboarding/:id/channels           → Save sales channels
 *  4  POST   /api/onboarding/:id/locations          → Save store locations
 *  5  POST   /api/onboarding/:id/pos                → Save POS system
 *  6  POST   /api/onboarding/:id/financial-history  → Save financial records
 *  7  POST   /api/onboarding/:id/compliance         → Save compliance info
 *  8  POST   /api/onboarding/:id/confirm            → Mark onboarding complete
 *  ─  GET    /api/onboarding/:id/summary            → Full summary for review
 *  ─  GET    /api/onboarding/:id/prefill            → Pre-fill data for edit mode
 * ─────────────────────────────────────────────────────────────────────────────
 */

import Business            from "../models/business.model.js";
import BusinessLocation    from "../models/businessLocation.model.js";
import BusinessSalesChannel from "../models/businessSalesChannel.model.js";
import BusinessPosSystem   from "../models/businessPosSystem.model.js";
import FinancialHistory    from "../models/financialHistory.model.js";
import { BusinessCompliance } from "../models/onlineOrder.model.js";

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/** Consistent success response */
const ok = (res, data, status = 200) =>
  res.status(status).json({ success: true, ...data });

/** Consistent error response */
const fail = (res, message, status = 400) =>
  res.status(status).json({ success: false, message });

/** Async wrapper — catches and returns 500 automatically */
const wrap = (fn) => async (req, res) => {
  try {
    await fn(req, res);
  } catch (err) {
    console.error(`[Onboarding] ${req.method} ${req.originalUrl}:`, err.message);
    return fail(res, err.message || "Internal server error.", 500);
  }
};

/** Fetch a business that belongs to the authenticated user */
const getBiz = async (id, userId) =>
  Business.findOne({ where: { id, userId } });

// ─────────────────────────────────────────────────────────────────────────────
// STEP 1 — Create OR resume existing business
// POST /api/onboarding/start
// ─────────────────────────────────────────────────────────────────────────────
export const startOnboarding = wrap(async (req, res) => {
  const {
    businessId,                // present when EDITING an existing business
    businessName, industry, businessType, businessModel, stage,
    country, state, city, pincode, website, description, currency,
    employeeCount, brandName,
  } = req.body;

  if (!businessName?.trim()) {
    return fail(res, "businessName is required.", 422);
  }

  const fields = {
    businessName: businessName.trim(),
    industry, businessType, businessModel,
    stage:         stage || "Early Revenue",
    country, state, city, pincode,
    website, description,
    currency:      currency || "USD",
    employeeCount, brandName,
  };

  let business;
  let isNew = false;

  if (businessId) {
    // ── EDIT MODE: update the existing business ─────────────────────────────
    business = await getBiz(businessId, req.user.id);
    if (!business) return fail(res, "Business not found.", 404);

    await business.update({ ...fields, onboardingStep: Math.max(business.onboardingStep, 1) });
  } else {
    // ── CREATE MODE: check for an incomplete onboarding session first ────────
    // This prevents duplicate businesses if the user refreshes Step 1
    const inProgress = await Business.findOne({
      where: {
        userId:         req.user.id,
        onboardingDone: false,
      },
      order: [["createdAt", "DESC"]],
    });

    if (inProgress) {
      // Resume the in-progress session by updating Step 1 fields
      await inProgress.update({ ...fields, onboardingStep: Math.max(inProgress.onboardingStep, 1) });
      business = inProgress;
    } else {
      // Fresh start
      business = await Business.create({
        userId:         req.user.id,
        ...fields,
        onboardingStep: 1,
        onboardingDone: false,
        isDemo:         false,
      });
      isNew = true;
    }
  }

  return ok(res, { message: isNew ? "Business created." : "Business updated.", business }, isNew ? 201 : 200);
});

// ─────────────────────────────────────────────────────────────────────────────
// STEP 2 — Operating model
// PATCH /api/onboarding/:businessId/operating-model
// ─────────────────────────────────────────────────────────────────────────────
export const saveOperatingModel = wrap(async (req, res) => {
  const biz = await getBiz(req.params.businessId, req.user.id);
  if (!biz) return fail(res, "Business not found.", 404);

  const { operatingModel } = req.body;
  if (!operatingModel) return fail(res, "operatingModel is required.", 422);

  await biz.update({
    operatingModel,
    onboardingStep: Math.max(biz.onboardingStep, 2),
  });

  return ok(res, { message: "Operating model saved.", business: biz });
});

// ─────────────────────────────────────────────────────────────────────────────
// STEP 3 — Sales channels
// POST /api/onboarding/:businessId/channels
// ─────────────────────────────────────────────────────────────────────────────
export const saveSalesChannels = wrap(async (req, res) => {
  const biz = await getBiz(req.params.businessId, req.user.id);
  if (!biz) return fail(res, "Business not found.", 404);

  const { channels } = req.body;
  if (!Array.isArray(channels) || channels.length === 0) {
    return fail(res, "channels array is required.", 422);
  }

  // Upsert pattern: destroy existing then bulk-insert
  await BusinessSalesChannel.destroy({ where: { businessId: biz.id } });
  const created = await BusinessSalesChannel.bulkCreate(
    channels.map((c) => ({ ...c, businessId: biz.id }))
  );

  await biz.update({ onboardingStep: Math.max(biz.onboardingStep, 3) });

  return ok(res, { message: "Sales channels saved.", channels: created });
});

// ─────────────────────────────────────────────────────────────────────────────
// STEP 4 — Store locations
// POST /api/onboarding/:businessId/locations
// ─────────────────────────────────────────────────────────────────────────────
export const saveLocations = wrap(async (req, res) => {
  const biz = await getBiz(req.params.businessId, req.user.id);
  if (!biz) return fail(res, "Business not found.", 404);

  const { locations } = req.body;
  if (!Array.isArray(locations) || locations.length === 0) {
    return fail(res, "locations array is required.", 422);
  }

  await BusinessLocation.destroy({ where: { businessId: biz.id } });
  const created = await BusinessLocation.bulkCreate(
    locations.map((l) => ({ ...l, businessId: biz.id }))
  );

  await biz.update({ onboardingStep: Math.max(biz.onboardingStep, 4) });

  return ok(res, { message: "Locations saved.", locations: created });
});

// ─────────────────────────────────────────────────────────────────────────────
// STEP 5 — POS / billing system
// POST /api/onboarding/:businessId/pos
// ─────────────────────────────────────────────────────────────────────────────
export const savePosSystem = wrap(async (req, res) => {
  const biz = await getBiz(req.params.businessId, req.user.id);
  if (!biz) return fail(res, "Business not found.", 404);

  const { provider, billingSoftware, terminalCount, canExportSales, canExportInventory } = req.body;

  // Upsert: remove old record and insert fresh
  await BusinessPosSystem.destroy({ where: { businessId: biz.id } });
  const pos = await BusinessPosSystem.create({
    businessId:          biz.id,
    provider,
    billingSoftware,
    terminalCount,
    canExportSales:      !!canExportSales,
    canExportInventory:  !!canExportInventory,
  });

  await biz.update({ onboardingStep: Math.max(biz.onboardingStep, 5) });

  return ok(res, { message: "POS system saved.", pos });
});

// ─────────────────────────────────────────────────────────────────────────────
// STEP 6 — Financial history (manual rows)
// POST /api/onboarding/:businessId/financial-history
// ─────────────────────────────────────────────────────────────────────────────
export const saveFinancialHistory = wrap(async (req, res) => {
  const biz = await getBiz(req.params.businessId, req.user.id);
  if (!biz) return fail(res, "Business not found.", 404);

  const { records } = req.body;
  if (!Array.isArray(records) || records.length === 0) {
    return fail(res, "records array is required.", 422);
  }

  await FinancialHistory.destroy({ where: { businessId: biz.id } });
  const created = await FinancialHistory.bulkCreate(
    records.map((r) => ({ ...r, businessId: biz.id }))
  );

  await biz.update({ onboardingStep: Math.max(biz.onboardingStep, 6) });

  return ok(res, { message: "Financial history saved.", records: created });
});

// ─────────────────────────────────────────────────────────────────────────────
// STEP 7 — Compliance
// POST /api/onboarding/:businessId/compliance
// ─────────────────────────────────────────────────────────────────────────────
export const saveCompliance = wrap(async (req, res) => {
  const biz = await getBiz(req.params.businessId, req.user.id);
  if (!biz) return fail(res, "Business not found.", 404);

  const [compliance] = await BusinessCompliance.upsert({
    businessId: biz.id,
    ...req.body,
  });

  await biz.update({ onboardingStep: Math.max(biz.onboardingStep, 7) });

  return ok(res, { message: "Compliance info saved.", compliance });
});

// ─────────────────────────────────────────────────────────────────────────────
// STEP 8 — Confirm & complete
// POST /api/onboarding/:businessId/confirm
// ─────────────────────────────────────────────────────────────────────────────
export const confirmOnboarding = wrap(async (req, res) => {
  const biz = await getBiz(req.params.businessId, req.user.id);
  if (!biz) return fail(res, "Business not found.", 404);

  await biz.update({ onboardingDone: true, onboardingStep: 99 });

  return ok(res, { message: "Onboarding complete!", business: biz });
});

// ─────────────────────────────────────────────────────────────────────────────
// GET summary — full data for the review screen
// GET /api/onboarding/:businessId/summary
// ─────────────────────────────────────────────────────────────────────────────
export const getOnboardingSummary = wrap(async (req, res) => {
  const biz = await getBiz(req.params.businessId, req.user.id);
  if (!biz) return fail(res, "Business not found.", 404);

  const [locations, channels, pos, compliance, financial] = await Promise.all([
    BusinessLocation.findAll({ where: { businessId: biz.id } }),
    BusinessSalesChannel.findAll({ where: { businessId: biz.id } }),
    BusinessPosSystem.findAll({ where: { businessId: biz.id } }),
    BusinessCompliance.findOne({ where: { businessId: biz.id } }),
    FinancialHistory.findAll({
      where: { businessId: biz.id },
      order: [["periodStart", "ASC"]],
    }),
  ]);

  return ok(res, { business: biz, locations, channels, pos, compliance, financial });
});

// ─────────────────────────────────────────────────────────────────────────────
// GET prefill — returns all saved data needed to pre-populate the wizard
// GET /api/onboarding/:businessId/prefill
//
// Used when:
//  • User revisits onboarding mid-session (onboardingDone: false)
//  • User clicks "Edit Business" from the dashboard (onboardingDone: true)
// ─────────────────────────────────────────────────────────────────────────────
export const getOnboardingPrefill = wrap(async (req, res) => {
  const biz = await getBiz(req.params.businessId, req.user.id);
  if (!biz) return fail(res, "Business not found.", 404);

  const [locations, channels, pos, compliance, financial] = await Promise.all([
    BusinessLocation.findAll({ where: { businessId: biz.id } }),
    BusinessSalesChannel.findAll({ where: { businessId: biz.id } }),
    BusinessPosSystem.findOne({ where: { businessId: biz.id } }),
    BusinessCompliance.findOne({ where: { businessId: biz.id } }),
    FinancialHistory.findAll({
      where: { businessId: biz.id },
      order: [["periodStart", "ASC"]],
    }),
  ]);

  // Build the flat form object the frontend wizard expects
  return ok(res, {
    prefill: {
      // Step 1 — Business details
      businessId:            biz.id,
      businessName:          biz.businessName,
      brandName:             biz.brandName,
      industry:              biz.industry,
      businessType:          biz.businessType,
      businessModel:         biz.businessModel,
      stage:                 biz.stage,
      country:               biz.country,
      state:                 biz.state,
      city:                  biz.city,
      pincode:               biz.pincode,
      website:               biz.website,
      description:           biz.description,
      currency:              biz.currency,
      employeeCount:         biz.employeeCount,

      // Step 2 — Operating model
      operatingModel:        biz.operatingModel,

      // Step 3 — Sales channels  (array of { channelType, platformName, ... })
      channels:              channels.map((c) => c.toJSON()),

      // Step 4 — Store locations
      locations:             locations.map((l) => l.toJSON()),

      // Step 5 — POS
      pos:                   pos ? pos.toJSON() : null,

      // Step 6 — Financial records
      financialRecords:      financial.map((f) => f.toJSON()),

      // Step 7 — Compliance
      compliance:            compliance ? compliance.toJSON() : null,

      // Meta
      onboardingStep:        biz.onboardingStep,
      onboardingDone:        biz.onboardingDone,
    },
  });
});
