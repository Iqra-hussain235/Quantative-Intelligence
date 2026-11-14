/**
 * fastapi.service.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Thin wrapper around the Python FastAPI ML service.
 * Node.js backend calls this to trigger ML processing.
 */

import axios            from "axios";
import FormData         from "form-data";
import fs               from "fs";

const ML_SERVICE_URL = process.env.ML_SERVICE_URL || "http://localhost:8001";
const ML_TIMEOUT_MS  = parseInt(process.env.ML_TIMEOUT_MS || "120000", 10); // 2 min

/**
 * Send a file to the FastAPI /process endpoint.
 * Returns the full JSON ML pipeline result.
 *
 * @param {string} filePath      - absolute path to the uploaded file on disk
 * @param {string} filename      - original filename (for extension detection)
 * @param {string} businessId    - passed to ML service for metadata
 * @param {string} userId        - passed to ML service for metadata
 * @returns {Promise<object>}    - the FastAPI response body
 */
export async function runMLPipeline(filePath, filename, businessId = "", userId = "") {
  const form = new FormData();
  form.append("file", fs.createReadStream(filePath), { filename });
  form.append("business_id", String(businessId));
  form.append("user_id",     String(userId));

  const response = await axios.post(
    `${ML_SERVICE_URL}/process`,
    form,
    {
      headers: {
        ...form.getHeaders(),
      },
      timeout: ML_TIMEOUT_MS,
      maxContentLength: Infinity,
      maxBodyLength:    Infinity,
    }
  );

  return response.data;
}

/**
 * Send a file + filters to the FastAPI /filter endpoint.
 * Returns re-computed KPIs for the filtered slice.
 */
export async function runMLFilter(filePath, filename, filters = {}) {
  const form = new FormData();
  form.append("file", fs.createReadStream(filePath), { filename });
  if (filters.region)     form.append("region",     filters.region);
  if (filters.category)   form.append("category",   filters.category);
  if (filters.start_date) form.append("start_date", filters.start_date);
  if (filters.end_date)   form.append("end_date",   filters.end_date);

  const response = await axios.post(
    `${ML_SERVICE_URL}/filter`,
    form,
    {
      headers: { ...form.getHeaders() },
      timeout: ML_TIMEOUT_MS,
      maxContentLength: Infinity,
      maxBodyLength:    Infinity,
    }
  );

  return response.data;
}

/**
 * Ping the ML service health endpoint.
 * Returns true if alive, false otherwise.
 */
export async function checkMLServiceHealth() {
  try {
    const res = await axios.get(`${ML_SERVICE_URL}/health`, { timeout: 5000 });
    return res.data?.status === "ok";
  } catch {
    return false;
  }
}
