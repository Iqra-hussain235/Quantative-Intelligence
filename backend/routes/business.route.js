/**
 * business.route.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Base path (registered in server.js):
 *   /api/business   (legacy alias)
 *   /api/businesses (canonical)
 *
 * All routes require Bearer token authentication (protect middleware).
 *
 * Route map
 * ─────────────────────────────────────────────────────────────────────────────
 *  Method  Path                         Handler               Description
 *  ------  ---------------------------  --------------------  ----------------
 *  POST    /                            createBusiness        Create business
 *  GET     /                            getUserBusinesses     List my businesses
 *  POST    /upload                      uploadBusinessFile    Upload data file
 *  GET     /:id                         getBusinessById       Get one business
 *  GET     /:id/metrics                 getBusinessMetrics    KPI dashboard data
 *  PUT     /:id                         updateBusiness        Full replacement
 *  PATCH   /:id                         patchBusiness         Partial update
 *  DELETE  /:id                         deleteBusiness        Soft-delete
 * ─────────────────────────────────────────────────────────────────────────────
 */

import express from "express";
import {
  createBusiness,
  getUserBusinesses,
  getBusinessById,
  getBusinessMetrics,
  uploadBusinessFile,
  updateBusiness,
  patchBusiness,
  deleteBusiness,
} from "../controllers/business.controller.js";
import { protect } from "../middleware/auth.middleware.js";
import upload     from "../middleware/upload.middleware.js";

const router = express.Router();

// ── Collection routes ─────────────────────────────────────────────────────────

// POST /api/businesses          — Create a new business for the logged-in user
router.post("/", protect, createBusiness);

// GET  /api/businesses          — List all businesses owned by the logged-in user
router.get("/", protect, getUserBusinesses);

// ── Upload (must be before /:id to avoid 'upload' being parsed as an id) ──────

// POST /api/businesses/upload   — Multipart upload of Excel/CSV/PDF data file
router.post("/upload", protect, upload.single("file"), uploadBusinessFile);

// ── Item routes ───────────────────────────────────────────────────────────────

// GET  /api/businesses/:id           — Get a single business by its ID
router.get("/:id", protect, getBusinessById);

// GET  /api/businesses/:id/metrics   — Get live KPI + chart data for the dashboard
router.get("/:id/metrics", protect, getBusinessMetrics);

// PUT  /api/businesses/:id           — Full replacement update (all fields required)
router.put("/:id", protect, updateBusiness);

// PATCH /api/businesses/:id          — Partial update (only sent fields are changed)
router.patch("/:id", protect, patchBusiness);

// DELETE /api/businesses/:id         — Delete a business (only owner can delete)
router.delete("/:id", protect, deleteBusiness);

export default router;