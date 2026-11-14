/**
 * ml.route.js
 * ─────────────────────────────────────────────────────────────────────────────
 * ML analytics routes. All protected by JWT.
 *
 *  POST   /api/businesses/:id/ml-upload      Upload dataset → run ML pipeline
 *  GET    /api/businesses/:id/ml-analytics   Get latest ML results
 *  POST   /api/businesses/:id/ml-filter      Filter results by region/category/date
 *  GET    /api/businesses/:id/ml-uploads     List all uploads for a business
 *  GET    /api/ml/health                     ML service liveness check
 * ─────────────────────────────────────────────────────────────────────────────
 */

import express from "express";
import {
  mlUpload,
  getMLAnalytics,
  mlFilter,
  listMLUploads,
  mlServiceHealth,
} from "../controllers/ml.controller.js";
import { protect } from "../middleware/auth.middleware.js";
import upload from "../middleware/upload.middleware.js";
import {
  getImports,
  getCustomers,
  getProducts,
  simulateScenario,
  getCompetitors,
} from "../controllers/businessData.controller.js";

const router = express.Router();

// ── Business-scoped ML routes ─────────────────────────────────────────────────

// Upload a dataset and trigger the ML pipeline
router.post(
  "/:id/ml-upload",
  protect,
  upload.single("file"),
  mlUpload
);

// Retrieve the latest ML analytics results
router.get("/:id/ml-analytics", protect, getMLAnalytics);

// Re-run the pipeline on a filtered slice of the uploaded data
router.post("/:id/ml-filter", protect, mlFilter);

// List all uploaded datasets for this business
router.get("/:id/ml-uploads", protect, listMLUploads);

// ── Accumulated business data ────────────────────────────────────────────────
router.get("/:id/imports", protect, getImports);
router.get("/:id/customers", protect, getCustomers);
router.get("/:id/products", protect, getProducts);
router.post("/:id/simulate", protect, simulateScenario);
router.get("/:id/competitors", protect, getCompetitors);

export default router;
