/**
 * ml.controller.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Handles ML-related routes for /api/businesses/:id/ml-*
 *
 * Endpoints:
 *   POST  /api/businesses/:id/ml-upload     Upload file → trigger ML pipeline → save results
 *   GET   /api/businesses/:id/ml-analytics  Retrieve latest ML results for the business
 *   POST  /api/businesses/:id/ml-filter     Re-run with filters on last uploaded dataset
 *   GET   /api/businesses/:id/ml-uploads    List all dataset uploads for a business
 *   GET   /api/ml/health                    Check if ML service is alive
 * ─────────────────────────────────────────────────────────────────────────────
 */

import path from "path";
import fs from "fs";
import Business from "../models/business.model.js";
import DatasetUpload from "../models/datasetUpload.model.js";
import MlResult from "../models/mlResult.model.js";
import BusinessRecord from "../models/businessRecord.model.js";
import BusinessImport from "../models/businessImport.model.js";
import { runMLPipeline, runMLFilter, checkMLServiceHealth } from "../services/fastapi.service.js";
import {
  importRecords,
  exportHistoryCsv,
  getRecordStats,
} from "../services/businessData.service.js";

// ── Helpers ───────────────────────────────────────────────────────────────────

const ok = (res, data, status = 200) =>
  res.status(status).json({ success: true, ...data });

const fail = (res, message, status = 400) =>
  res.status(status).json({ success: false, message });

const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch((err) => {
    console.error(`[ML Error] ${req.method} ${req.originalUrl}:`, err.message);
    return fail(res, err.message || "Internal server error.", 500);
  });

/** Ensure business belongs to user */
const findOwnedBusiness = async (businessId, userId) =>
  Business.findOne({ where: { id: businessId, userId } });

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/businesses/:id/ml-upload
// Upload a CSV/Excel file → call FastAPI → save results to DB
// ─────────────────────────────────────────────────────────────────────────────
export const mlUpload = asyncHandler(async (req, res) => {
  const businessId = req.params.id;
  const userId = req.user.id;

  if (!req.file) {
    return fail(res, "No file uploaded. Send multipart/form-data with field 'file'.", 422);
  }

  const business = await findOwnedBusiness(businessId, userId);
  if (!business) return fail(res, "Business not found.", 404);

  // ── 1. Record the upload in DB ────────────────────────────────────────────
  const upload = await DatasetUpload.create({
    businessId,
    userId,
    originalName: req.file.originalname,
    storedFilename: req.file.filename,
    filePath: req.file.path,
    mimeType: req.file.mimetype,
    sizeBytes: req.file.size,
    status: "processing",
  });

  // ── 2. Accumulate normalized records (historical store) ────────────────────
  // Parse → normalize → dedupe/upsert into business_records. This runs even
  // if the ML service is down so history is never lost.
  let importStats = null;
  try {
    const { stats } = await importRecords({
      businessId,
      userId,
      datasetUploadId: upload.id,
      filePath: req.file.path,
      fileName: req.file.originalname,
    });
    importStats = stats;
  } catch (err) {
    console.error("[ML] Record import failed:", err.message);
    await upload.update({ status: "error", errorMessage: `Record import failed: ${err.message}` });
    return fail(res, `Failed to store business records: ${err.message}`, 500);
  }

  // ── 3. Call FastAPI ML service on the FULL accumulated history ─────────────
  // When records were stored we export the complete history as a canonical
  // CSV so every metric/forecast covers all imports to date. Fall back to
  // the raw uploaded file when nothing could be normalized.
  let mlFilePath = req.file.path;
  let mlFileName = req.file.originalname;
  let usedHistory = false;
  if (importStats?.mapped) {
    const historyPath = await exportHistoryCsv(businessId, userId);
    if (historyPath && fs.existsSync(historyPath)) {
      mlFilePath = historyPath;
      mlFileName = `history_${businessId}.csv`;
      usedHistory = true;
    }
  }

  let mlData;
  try {
    mlData = await runMLPipeline(
      mlFilePath,
      mlFileName,
      businessId,
      userId
    );
  } catch (err) {
    // Mark upload as error but still respond with a helpful message
    await upload.update({ status: "error", errorMessage: err.message });
    const detail =
      err.response?.data?.detail || err.message || "ML service unavailable.";
    return fail(
      res,
      `ML pipeline failed: ${detail}. Records were still stored — fix the ML service and re-upload to regenerate analytics. Ensure the Python FastAPI service is running on port 8001.`,
      503
    );
  }

  // ── 3. Persist ML results ─────────────────────────────────────────────────
  const kpis = mlData.kpis || {};

  // Upsert: overwrite any existing result for this upload
  const [mlResult] = await MlResult.upsert({
    uploadId: upload.id,
    businessId,
    userId,
    results: mlData,
    totalRevenue: kpis.total_revenue ?? null,
    customerCount: kpis.customer_count ?? null,
    profitMargin: kpis.profit_margin ?? null,
    averageOrderValue: kpis.average_order_value ?? null,
    anomalyCount: mlData.anomaly_summary?.anomaly_count ?? null,
    anomalyPercentage: mlData.anomaly_summary?.anomaly_percentage ?? null,
    processedAt: new Date(),
  });

  // Update upload record with final stats
  await upload.update({
    status: "done",
    totalRecords: mlData.meta?.total_records ?? null,
    cleanedRecords: mlData.meta?.cleaned_records ?? null,
  });

  // Also update business record to flag it has an uploaded file
  await business.update({ uploadedFile: req.file.filename });

  return ok(res, {
    message: "File processed by ML pipeline and results saved.",
    uploadId: upload.id,
    mlResultId: mlResult.id ?? mlResult?.dataValues?.id,
    import: importStats,
    historyRecordsUsed: usedHistory,
    summary: {
      total_records: mlData.meta?.total_records,
      cleaned_records: mlData.meta?.cleaned_records,
      kpis,
      anomaly_summary: mlData.anomaly_summary,
      alerts: mlData.alerts,
    },
    data: mlData,
  }, 201);
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/businesses/:id/ml-analytics
// Return the latest saved ML results for the dashboard
// ─────────────────────────────────────────────────────────────────────────────
export const getMLAnalytics = asyncHandler(async (req, res) => {
  const businessId = req.params.id;
  const userId = req.user.id;

  const business = await findOwnedBusiness(businessId, userId);
  if (!business) return fail(res, "Business not found.", 404);

  const latestResult = await MlResult.findOne({
    where: { businessId, userId },
    order: [["processedAt", "DESC"]],
  });

  if (!latestResult) {
    // No ML results yet — not an error, just empty
    return ok(res, {
      hasMLData: false,
      mlResults: null,
      message: "No ML results yet. Upload a CSV/Excel dataset to generate analytics.",
    });
  }

  const upload = await DatasetUpload.findByPk(latestResult.uploadId);

  return ok(res, {
    hasMLData: true,
    uploadInfo: {
      id: upload?.id,
      originalName: upload?.originalName,
      uploadedAt: upload?.createdAt,
      totalRecords: upload?.totalRecords,
      cleanedRecords: upload?.cleanedRecords,
    },
    processedAt: latestResult.processedAt,
    // Flat KPIs for convenience
    kpis: {
      total_revenue: latestResult.totalRevenue ? Number(latestResult.totalRevenue) : null,
      customer_count: latestResult.customerCount,
      profit_margin: latestResult.profitMargin ? Number(latestResult.profitMargin) : null,
      average_order_value: latestResult.averageOrderValue ? Number(latestResult.averageOrderValue) : null,
      anomaly_count: latestResult.anomalyCount,
      anomaly_percentage: latestResult.anomalyPercentage ? Number(latestResult.anomalyPercentage) : null,
    },
    // Full results (charts, alerts, cleaning_report, etc.)
    mlResults: latestResult.results,
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/businesses/:id/ml-filter
// Re-run with filters on the last uploaded dataset
// ─────────────────────────────────────────────────────────────────────────────
export const mlFilter = asyncHandler(async (req, res) => {
  const businessId = req.params.id;
  const userId = req.user.id;

  const business = await findOwnedBusiness(businessId, userId);
  if (!business) return fail(res, "Business not found.", 404);

  // Find the most recent completed upload
  const latestUpload = await DatasetUpload.findOne({
    where: { businessId, userId, status: "done" },
    order: [["createdAt", "DESC"]],
  });

  if (!latestUpload) {
    return fail(res, "No completed dataset upload found. Please upload a file first.", 404);
  }

  const filters = {
    region: req.body.region || "",
    category: req.body.category || "",
    start_date: req.body.start_date || "",
    end_date: req.body.end_date || "",
  };

  let filterData;
  try {
    filterData = await runMLFilter(
      latestUpload.filePath,
      latestUpload.originalName,
      filters
    );
  } catch (err) {
    const detail = err.response?.data?.detail || err.message;
    return fail(res, `Filter failed: ${detail}`, 503);
  }

  return ok(res, {
    filters,
    ...filterData,
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/businesses/:id/ml-uploads
// List all dataset uploads for a business
// ─────────────────────────────────────────────────────────────────────────────
export const listMLUploads = asyncHandler(async (req, res) => {
  const businessId = req.params.id;
  const userId = req.user.id;

  const business = await findOwnedBusiness(businessId, userId);
  if (!business) return fail(res, "Business not found.", 404);

  const uploads = await DatasetUpload.findAll({
    where: { businessId, userId },
    order: [["createdAt", "DESC"]],
    attributes: [
      "id", "originalName", "status", "totalRecords", "cleanedRecords",
      "sizeBytes", "createdAt", "errorMessage",
    ],
  });

  return ok(res, { count: uploads.length, uploads });
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/ml/health
// ─────────────────────────────────────────────────────────────────────────────
export const mlServiceHealth = asyncHandler(async (_req, res) => {
  const alive = await checkMLServiceHealth();
  return ok(res, {
    mlService: alive ? "online" : "offline",
    url: process.env.ML_SERVICE_URL || "http://localhost:8001",
  });
});
