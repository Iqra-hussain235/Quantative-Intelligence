/**
 * onboarding.route.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Base path: /api/onboarding
 * All routes require Bearer token (protect middleware).
 *
 * Route map
 * ─────────────────────────────────────────────────────────────────────────────
 *  Method  Path                              Handler                 Step
 *  ──────  ────────────────────────────────  ──────────────────────  ────
 *  POST    /start                            startOnboarding         1
 *  PATCH   /:businessId/operating-model      saveOperatingModel      2
 *  POST    /:businessId/channels             saveSalesChannels       3
 *  POST    /:businessId/locations            saveLocations           4
 *  POST    /:businessId/pos                  savePosSystem           5
 *  POST    /:businessId/financial-history    saveFinancialHistory    6
 *  POST    /:businessId/compliance           saveCompliance          7
 *  POST    /:businessId/confirm              confirmOnboarding       8
 *  GET     /:businessId/summary             getOnboardingSummary    review
 *  GET     /:businessId/prefill             getOnboardingPrefill    edit/resume
 * ─────────────────────────────────────────────────────────────────────────────
 */

import express from "express";
import {
  startOnboarding,
  saveOperatingModel,
  saveSalesChannels,
  saveLocations,
  savePosSystem,
  saveFinancialHistory,
  saveCompliance,
  confirmOnboarding,
  getOnboardingSummary,
  getOnboardingPrefill,
} from "../controllers/onboarding.controller.js";
import { protect } from "../middleware/auth.middleware.js";

const router = express.Router();

// ── Step 1 — Create / resume business ────────────────────────────────────────
// Supports both CREATE (no businessId in body) and UPDATE (businessId in body)
router.post("/start", protect, startOnboarding);

// ── Step 2 — Operating model ──────────────────────────────────────────────────
router.patch("/:businessId/operating-model", protect, saveOperatingModel);

// ── Step 3 — Sales channels ───────────────────────────────────────────────────
router.post("/:businessId/channels", protect, saveSalesChannels);

// ── Step 4 — Store locations (offline / hybrid) ───────────────────────────────
router.post("/:businessId/locations", protect, saveLocations);

// ── Step 5 — POS / billing system ────────────────────────────────────────────
router.post("/:businessId/pos", protect, savePosSystem);

// ── Step 6 — Financial history (manual) ──────────────────────────────────────
router.post("/:businessId/financial-history", protect, saveFinancialHistory);

// ── Step 7 — Compliance ───────────────────────────────────────────────────────
router.post("/:businessId/compliance", protect, saveCompliance);

// ── Step 8 — Confirm & complete ───────────────────────────────────────────────
router.post("/:businessId/confirm", protect, confirmOnboarding);

// ── Review screen — full summary ──────────────────────────────────────────────
router.get("/:businessId/summary", protect, getOnboardingSummary);

// ── Edit / resume — pre-fill all saved data back into the wizard ──────────────
// Returns a flat "prefill" object the wizard form can hydrate directly
router.get("/:businessId/prefill", protect, getOnboardingPrefill);

export default router;
