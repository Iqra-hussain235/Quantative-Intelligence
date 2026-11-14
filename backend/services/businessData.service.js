/**
 * businessData.service.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Historical data accumulation for existing businesses.
 *
 *  parseUploadRows()   → raw rows from CSV/XLSX
 *  normalizeRows()     → map arbitrary column names to canonical fields
 *  importRecords()     → dedupe + upsert into business_records, log import
 *  exportHistoryCsv()  → write ALL accumulated records as a canonical CSV
 *                        that the FastAPI ML pipeline can consume directly
 *
 * Dedupe strategy
 * ────────────────
 * Each normalized line gets a dedupeKey:
 *   with order_id    → orderId | productKey | lineSeq
 *                      (lineSeq = nth occurrence of that product within the
 *                       order in this file — keeps multi-line orders intact
 *                       and lets corrected re-uploads update in place)
 *   without order_id → sha1 of the full normalized row (identical rows are
 *                      duplicates; changed rows are treated as new records)
 * ─────────────────────────────────────────────────────────────────────────────
 */

import fs from "fs";
import path from "path";
import crypto from "crypto";
import csv from "csv-parser";
import * as XLSX from "xlsx";
import BusinessRecord from "../models/businessRecord.model.js";
import BusinessImport from "../models/businessImport.model.js";

// ── Column alias map (canonical field → accepted source names, normalized) ────
// normalize() lowercases, trims, and collapses [_\-\s]+ → single space.
const ALIASES = {
  orderId: ["order id", "order_id", "order number", "order_number", "order no", "invoice id", "invoice_id", "transaction id", "transaction_id", "bill no", "receipt no", "orderid"],
  orderDate: ["order date", "order_date", "date", "sale date", "sales date", "transaction date", "booking date", "created at", "date of sale"],
  orderTime: ["order time", "order_time", "time", "order_time_", "transaction time", "time of order"],
  customerId: ["customer id", "customer_id", "customer", "client id", "client_id", "member id", "member_id", "customer name", "customer_name", "client name", "client_name", "guest id", "walk_in"],
  productId: ["product id", "product_id", "sku", "item id", "item_id", "product code", "product_code", "code", "item code", "item_code", "menu item id"],
  productName: ["product name", "product_name", "item name", "item_name", "menu item", "menu_item", "product", "item", "dish", "menu item name", "item description", "product description"],
  category: ["category", "product category", "product_category", "category name", "food category", "menu category", "item category", "type", "product type", "product_type"],
  quantity: ["quantity", "qty", "units", "units sold", "qty sold", "no of units", "number of units", "portion", "portions"],
  unitPrice: ["unit price", "unit_price", "price", "rate", "unit rate", "mrp", "selling price", "price per unit"],
  sales: ["sales", "sale amount", "sale_amount", "amount", "total", "total amount", "total_amount", "line total", "line_total", "revenue", "sales amount", "sales_amount", "net sales", "extended price", "extended_price", "grand total", "order value", "value"],
  cost: ["cost", "cost amount", "cost_amount", "cogs", "cost of goods sold", "unit cost", "cost price", "purchase cost", "total cost"],
  profit: ["profit", "gross profit", "gross_profit", "net profit", "net_profit", "profit amount", "profit_amount", "margin amount"],
  paymentMethod: ["payment method", "payment_method", "payment", "payment mode", "payment_mode", "payment type", "pay mode"],
  orderType: ["order type", "order_type", "order source", "order_source", "channel", "sales channel", "sales_channel", "fulfilment", "fulfillment", "service type", "order_mode", "dine in", "takeaway", "delivery"],
  orderStatus: ["order status", "order_status", "status", "payment status", "payment_status", "fulfilment status", "delivery status"],
  city: ["city", "town", "branch", "location", "store", "outlet", "restaurant", "venue", "area"],
  currency: ["currency", "currency code", "ccy"],
  discount: ["discount", "discount amount", "discount_amount", "discount %", "discount_percent"],
  tax: ["tax", "tax amount", "tax_amount", "gst", "vat"],
};

const norm = (s) =>
  String(s ?? "").trim().toLowerCase().replace(/[_\-]+/g, " ").replace(/\s+/g, " ");

// Build normalized alias → canonical lookup once
const ALIAS_LOOKUP = {};
for (const [canon, names] of Object.entries(ALIASES)) {
  for (const n of names) ALIAS_LOOKUP[norm(n)] = canon;
}

// ── Parsing ──────────────────────────────────────────────────────────────────

export function parseUploadRows(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".csv") {
    return new Promise((resolve, reject) => {
      const rows = [];
      fs.createReadStream(filePath)
        .pipe(csv())
        .on("data", (r) => rows.push(r))
        .on("end", () => resolve(rows))
        .on("error", reject);
    });
  }
  if (ext === ".xlsx" || ext === ".xls") {
    const wb = XLSX.readFile(filePath);
    const sheet = wb.Sheets[wb.SheetNames[0]];
    return XLSX.utils.sheet_to_json(sheet, { defval: "" });
  }
  throw new Error(`Unsupported file type: ${ext}`);
}

// ── Normalization ────────────────────────────────────────────────────────────

function num(v) {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(String(v).replace(/[,₹$€£\s]/g, ""));
  return Number.isFinite(n) ? n : null;
}

function txt(v) {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s === "" || s.toLowerCase() === "nan" || s.toLowerCase() === "null" ? null : s;
}

function dateOnly(v) {
  const t = txt(v);
  if (!t) return null;
  const d = new Date(t);
  if (isNaN(d)) {
    // try dd/mm/yyyy or dd-mm-yyyy
    const m = t.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
    if (m) {
      const dd = +m[1], mm = +m[2], yy = m[3].length === 2 ? 2000 + +m[3] : +m[3];
      const d2 = new Date(yy, mm - 1, dd);
      return isNaN(d2) ? null : d2.toISOString().slice(0, 10);
    }
    return null;
  }
  return d.toISOString().slice(0, 10);
}

function timeOnly(v) {
  const t = txt(v);
  if (!t) return null;
  const m = t.match(/(\d{1,2})[:.](\d{2})(?:[:.](\d{2}))?/);
  if (!m) return null;
  const h = +m[1], mi = +m[2], s = +(m[3] || 0);
  if (h > 23 || mi > 59 || s > 59) return null;
  return `${String(h).padStart(2, "0")}:${String(mi).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

/**
 * Map raw file rows → canonical record objects.
 * Returns { records, mapping, unmappedColumns }.
 */
export function normalizeRows(rawRows) {
  if (!Array.isArray(rawRows) || rawRows.length === 0) {
    return { records: [], mapping: {}, unmappedColumns: [] };
  }

  const columns = Object.keys(rawRows[0]);
  const colToCanon = {};
  const mapping = {};
  const unmapped = [];

  for (const col of columns) {
    const canon = ALIAS_LOOKUP[norm(col)];
    if (canon) {
      colToCanon[col] = canon;
      mapping[col] = canon;
    } else {
      unmapped.push(col);
    }
  }

  const records = [];
  for (const raw of rawRows) {
    const rec = {};
    for (const [col, canon] of Object.entries(colToCanon)) {
      if (rec[canon] !== undefined && rec[canon] !== null) continue; // first match wins
      rec[canon] = raw[col];
    }

    // Canonical cleaning
    const orderId = txt(rec.orderId);
    const productName = txt(rec.productName);
    const productId = txt(rec.productId);
    const sales = num(rec.sales);
    const quantity = num(rec.quantity);

    // Skip completely empty rows
    if (!orderId && !productName && sales == null && quantity == null) continue;

    records.push({
      orderId,
      orderDate: dateOnly(rec.orderDate),
      orderTime: timeOnly(rec.orderTime),
      customerId: txt(rec.customerId),
      productId,
      productName,
      category: txt(rec.category),
      quantity,
      unitPrice: num(rec.unitPrice),
      sales,
      cost: num(rec.cost),
      profit: num(rec.profit),
      paymentMethod: txt(rec.paymentMethod),
      orderType: txt(rec.orderType),
      orderStatus: txt(rec.orderStatus),
      city: txt(rec.city),
      currency: txt(rec.currency),
      discount: num(rec.discount),
      tax: num(rec.tax),
    });
  }

  return { records, mapping, unmappedColumns: unmapped };
}

// ── Dedupe keys ───────────────────────────────────────────────────────────────

function sha1(s) {
  return crypto.createHash("sha1").update(s).digest("hex");
}

/**
 * Assign dedupeKeys. For order-based data, key = orderId|productKey|lineSeq
 * so corrected re-uploads update the same line. Without orderId, key = hash
 * of the full row content.
 */
export function assignDedupeKeys(records) {
  const seqCounter = new Map(); // orderId|productKey → next seq

  return records.map((r) => {
    const productKey = r.productId || r.productName || "item";
    let key;
    if (r.orderId) {
      const base = `${r.orderId}|${productKey}`;
      const seq = seqCounter.get(base) || 0;
      seqCounter.set(base, seq + 1);
      key = `${base}|${seq}`;
    } else {
      key = "row|" + sha1(JSON.stringify([
        r.orderDate, r.orderTime, r.customerId, productKey, r.category,
        r.quantity, r.unitPrice, r.sales, r.cost, r.profit,
      ]));
    }
    return { ...r, dedupeKey: key };
  });
}

// ── Import ───────────────────────────────────────────────────────────────────

const INSERT_CHUNK = 500;

/**
 * Parse + normalize + upsert records for a business.
 * Returns BusinessImport stats. Never deletes existing history.
 */
export async function importRecords({
  businessId,
  userId,
  datasetUploadId = null,
  filePath,
  fileName = null,
}) {
  const ext = path.extname(filePath || "").toLowerCase();
  const rawRows = await parseUploadRows(filePath);
  const { records, mapping, unmappedColumns } = normalizeRows(rawRows);

  const imp = await BusinessImport.create({
    businessId,
    userId,
    datasetUploadId,
    fileName: fileName || path.basename(filePath || ""),
    fileType: ext.replace(".", ""),
    totalRows: rawRows.length,
    newRows: 0,
    updatedRows: 0,
    duplicateRows: 0,
    status: "completed",
    errorMessage: null,
  });
  if (records.length === 0) {
    await imp.update({ status: "failed", errorMessage: "No recognizable columns/rows after normalization." });
    return { import: imp, stats: { totalRows: rawRows.length, newRows: 0, updatedRows: 0, duplicateRows: 0, mapped: false } };
  }

  const keyed = assignDedupeKeys(records);

  // Which keys already exist for this business?
  const keys = keyed.map((r) => r.dedupeKey);
  const existing = await BusinessRecord.findAll({
    where: { businessId, dedupeKey: keys },
    attributes: ["dedupeKey"],
    raw: true,
  });
  const existingKeys = new Set(existing.map((e) => e.dedupeKey));

  const toInsert = [];
  const toUpdate = [];
  let duplicateRows = 0;

  // Group incoming by key — last occurrence in file wins (latest correction)
  const byKey = new Map();
  for (const r of keyed) byKey.set(r.dedupeKey, r);

  for (const [key, r] of byKey) {
    const payload = {
      businessId,
      userId,
      importId: imp.id,
      orderId: r.orderId,
      orderDate: r.orderDate,
      orderTime: r.orderTime,
      customerId: r.customerId,
      productId: r.productId,
      productName: r.productName,
      category: r.category,
      quantity: r.quantity,
      unitPrice: r.unitPrice,
      sales: r.sales,
      cost: r.cost,
      profit: r.profit,
      paymentMethod: r.paymentMethod,
      orderType: r.orderType,
      orderStatus: r.orderStatus,
      city: r.city || null,
      currency: r.currency || null,
    };

    if (existingKeys.has(key)) {
      toUpdate.push(BusinessRecord.update(payload, { where: { businessId, dedupeKey: key } }));
    } else {
      toInsert.push({ ...payload, dedupeKey: key });
    }
  }

  // Rows beyond the first occurrence of a key inside this file are duplicates
  duplicateRows = keyed.length - byKey.size;

  // Bulk insert in chunks
  for (let i = 0; i < toInsert.length; i += INSERT_CHUNK) {
    await BusinessRecord.bulkCreate(toInsert.slice(i, i + INSERT_CHUNK), {
      ignoreDuplicates: true,
    });
  }

  // Apply updates (corrections) — run sequentially per key to stay simple
  let updatedRows = 0;
  for (const p of toUpdate) {
    const [count] = await p;
    updatedRows += count || 0;
  }

  // Recount true duplicates skipped by ignoreDuplicates (race-safe)
  const actualNew = toInsert.length > 0
    ? await BusinessRecord.count({
      where: {
        businessId,
        dedupeKey: toInsert.map((r) => r.dedupeKey),
        importId: imp.id,
      },
    })
    : 0;

  const dates = keyed.map((r) => r.orderDate).filter(Boolean).sort();
  await imp.update({
    newRows: actualNew,
    updatedRows,
    duplicateRows: duplicateRows + Math.max(0, toInsert.length - actualNew),
    dateRangeStart: dates[0] || null,
    dateRangeEnd: dates[dates.length - 1] || null,
  });

  return {
    import: imp,
    stats: {
      totalRows: rawRows.length,
      normalizedRows: records.length,
      newRows: actualNew,
      updatedRows,
      duplicateRows: imp.duplicateRows,
      dateRangeStart: imp.dateRangeStart,
      dateRangeEnd: imp.dateRangeEnd,
      mapped: true,
      mapping,
      unmappedColumns,
    },
  };
}

// ── Export accumulated history for ML ────────────────────────────────────────

const EXPORT_COLUMNS = [
  // canonical names the FastAPI Module_1 mapping understands
  ["order_id", "orderId"],
  ["date", "orderDate"],
  ["time", "orderTime"],
  ["customer", "customerId"],
  ["product_id", "productId"],
  ["product", "productName"],
  ["category", "category"],
  ["quantity", "quantity"],
  ["unit_price", "unitPrice"],
  ["sales", "sales"],
  ["cost", "cost"],
  ["profit", "profit"],
  ["payment_method", "paymentMethod"],
  ["order_type", "orderType"],
  ["order_status", "orderStatus"],
  ["region", "city"],
  ["currency", "currency"],
];

function csvEscape(v) {
  if (v === null || v === undefined) return "";
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/**
 * Write ALL accumulated records for a business to a temp CSV using the
 * canonical column names Module_1 understands, and return the file path.
 * Returns null when the business has no records.
 */
export async function exportHistoryCsv(businessId, userId) {
  const records = await BusinessRecord.findAll({
    where: { businessId, userId },
    order: [["orderDate", "ASC"], ["id", "ASC"]],
    raw: true,
  });
  if (records.length === 0) return null;

  const header = EXPORT_COLUMNS.map(([h]) => h).join(",");
  const lines = [header];
  for (const r of records) {
    lines.push(
      EXPORT_COLUMNS.map(([, field]) => csvEscape(r[field])).join(",")
    );
  }

  const dir = path.join(process.cwd(), "uploads", "history");
  fs.mkdirSync(dir, { recursive: true });
  const filePath = path.join(dir, `biz_${businessId}_history.csv`);
  fs.writeFileSync(filePath, lines.join("\n"), "utf8");
  return filePath;
}

/** Count accumulated records for a business (for UI/status). */
export async function getRecordStats(businessId, userId) {
  const [total, imports] = await Promise.all([
    BusinessRecord.count({ where: { businessId, userId } }),
    BusinessImport.findAll({
      where: { businessId, userId },
      order: [["createdAt", "DESC"]],
      attributes: ["id", "fileName", "dateRangeStart", "dateRangeEnd", "totalRows", "newRows", "updatedRows", "duplicateRows", "status", "createdAt"],
      raw: true,
    }),
  ]);
  return { totalRecords: total, imports };
}
