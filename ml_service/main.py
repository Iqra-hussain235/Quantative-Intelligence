"""
Quantora FastAPI ML Service
────────────────────────────────────────────────────────────────────────────
Wraps Module_1 through Module_9 into REST endpoints.

POST /process        — full pipeline (ingest→clean→KPI→trend→anomaly→alerts)
POST /process-stream — returns chunked progress events (SSE)
GET  /health         — liveness probe
────────────────────────────────────────────────────────────────────────────
Run: uvicorn main:app --host 0.0.0.0 --port 8001 --reload
"""

import io
import os
import sys
import traceback
from pathlib import Path

import numpy as np
import pandas as pd
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

# ── Make Smart-Business-Dashboard importable ─────────────────────────────────
DASHBOARD_PATH = Path(__file__).parent.parent / "Smart-Business-Dashboard"
if str(DASHBOARD_PATH) not in sys.path:
    sys.path.insert(0, str(DASHBOARD_PATH))

from Module_1.data_ingestion import (
    load_data,
    validate_schema,
    standardize_column_names,
    standardize_data_types,
)
from Module_2.data_cleaning import clean_data
from Module_3.kpi_calculation import calculate_all_kpis
from Module_4.trend_seasonality import analyze_trend_seasonality
from Module_5.anomaly_detection import detect_anomalies, generate_anomaly_summary
from Module_6.cross_module_aggregator import aggregate_module_outputs
from Module_7.personalization_filtering import get_filter_options
from Module_8.visualization_rendering import prepare_visualization_data
from Module_9.live_refresh_alerting import generate_alerts
from Module_10.business_insights import generate_business_insights

# ── App ───────────────────────────────────────────────────────────────────────
app = FastAPI(
    title="Quantora ML Service",
    description="Runs ML pipeline (Modules 1-9) on uploaded business data.",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Helpers ───────────────────────────────────────────────────────────────────

def _to_serialisable(obj):
    """Recursively convert pandas/numpy objects to JSON-safe Python types."""
    if isinstance(obj, dict):
        return {str(k): _to_serialisable(v) for k, v in obj.items()}
    if isinstance(obj, (list, tuple)):
        return [_to_serialisable(i) for i in obj]
    if isinstance(obj, pd.Series):
        return {str(k): _to_serialisable(v) for k, v in obj.items()}
    if isinstance(obj, pd.DataFrame):
        return obj.reset_index().apply(
            lambda col: col.astype(str) if col.dtype == "object" else col
        ).to_dict(orient="records")
    if isinstance(obj, (np.integer,)):
        return int(obj)
    if isinstance(obj, (np.floating,)):
        return None if np.isnan(obj) else float(obj)
    if isinstance(obj, (np.bool_,)):
        return bool(obj)
    if isinstance(obj, (pd.Timestamp, pd.Period)):
        return str(obj)
    if isinstance(obj, float) and (np.isnan(obj) or np.isinf(obj)):
        return None
    return obj


def _safe_float(v):
    try:
        f = float(v)
        return None if np.isnan(f) or np.isinf(f) else f
    except (TypeError, ValueError):
        return None


def _detect_anomalies_with_records(df: pd.DataFrame):
    """
    Run Isolation Forest anomaly detection on the correct grain:
      - order level (sum of line sales per order_id) when order_id exists
      - row level otherwise

    Returns (summary_dict, records_list). Each record carries the date,
    order/row identifier, sales value and a human-readable reason so the
    dashboard can show exactly which transactions were flagged.
    """
    sales = pd.to_numeric(df["sales"], errors="coerce")

    if "order_id" in df.columns:
        work = pd.DataFrame({
            "order_id": df["order_id"],
            "date":    pd.to_datetime(df["date"], errors="coerce") if "date" in df.columns else pd.NaT,
            "sales":   sales,
        }).dropna(subset=["sales"])
        agg = (
            work.groupby("order_id", dropna=False)
            .agg(total_sales=("sales", "sum"), date=("date", "first"))
            .reset_index()
        )
        granularity = "order"
        id_col, val_col = "order_id", "total_sales"
        detect_df = agg.rename(columns={val_col: "sales"})
    else:
        work = pd.DataFrame({
            "date":  pd.to_datetime(df["date"], errors="coerce") if "date" in df.columns else pd.NaT,
            "sales": sales,
        }).dropna(subset=["sales"]).reset_index(drop=True)
        work["_row"] = work.index
        agg = work
        granularity = "record"
        id_col, val_col = "_row", "sales"
        detect_df = agg

    anomaly_df = detect_anomalies(detect_df)
    summary = generate_anomaly_summary(anomaly_df)
    summary["granularity"] = granularity
    summary["anomalies_detected"] = int(summary.get("anomaly_count", 0))

    flagged = anomaly_df[anomaly_df["anomaly"] == True]
    vals = pd.to_numeric(detect_df["sales"], errors="coerce")
    mean_v = float(vals.mean()) if len(vals) else 0.0
    std_v  = float(vals.std())  if len(vals) else 0.0

    records = []
    for _, row in flagged.iterrows():
        rec_id = row[id_col] if id_col in anomaly_df.columns else None
        sale_v = _safe_float(row["sales"])
        z = None
        if sale_v is not None and std_v and std_v > 0:
            z = (sale_v - mean_v) / std_v
        reason = (
            f"{granularity.capitalize()} total {sale_v:,.2f} deviates "
            f"{abs(z):.1f}σ from the mean ({mean_v:,.2f})"
            if sale_v is not None and z is not None
            else f"{granularity.capitalize()} flagged as statistical outlier"
        )
        d = row.get("date") if "date" in agg.columns else None
        records.append({
            "id":       None if rec_id is None or (isinstance(rec_id, float) and np.isnan(rec_id)) else str(rec_id),
            "date":     str(d.date()) if pd.notna(d) else None,
            "sales":    sale_v,
            "anomaly_score": _safe_float(row.get("anomaly_score")),
            "reason":   reason,
        })

    # Most anomalous first — Isolation Forest decision_function is most
    # negative for outliers.
    records.sort(key=lambda r: r.get("anomaly_score") if r.get("anomaly_score") is not None else 0.0)
    summary["records"] = records[:50]
    return summary, records


def _load_df_from_upload(file_bytes: bytes, filename: str) -> pd.DataFrame:
    """Load a DataFrame from raw bytes based on file extension."""
    ext = Path(filename).suffix.lower()
    buf = io.BytesIO(file_bytes)
    if ext == ".csv":
        return pd.read_csv(buf)
    elif ext in (".xlsx", ".xls"):
        return pd.read_excel(buf)
    elif ext == ".json":
        return pd.read_json(buf)
    elif ext == ".parquet":
        return pd.read_parquet(buf)
    raise ValueError(f"Unsupported file type: {ext}")


# ── Health check ──────────────────────────────────────────────────────────────

@app.get("/health")
def health():
    return {"status": "ok", "service": "quantora-ml"}


# ── Full ML pipeline ──────────────────────────────────────────────────────────

@app.post("/process")
async def process_dataset(
    file: UploadFile = File(...),
    business_id: str = Form(default=""),
    user_id: str = Form(default=""),
    region: str = Form(default=""),
    category: str = Form(default=""),
):
    """
    Run the full ML pipeline on an uploaded CSV/Excel file.

    Returns a JSON payload with:
      - kpis, trend, anomaly_summary, alerts
      - chart-ready data (revenue, category, region, anomaly charts)
      - filter options (available regions/categories)
      - data quality report from cleaning
    """
    raw_bytes = await file.read()
    filename  = file.filename or "upload.csv"

    # ── M1: Ingest & schema validation ───────────────────────────────────────
    try:
        raw_df = _load_df_from_upload(raw_bytes, filename)
    except Exception as exc:
        raise HTTPException(status_code=422, detail=f"Cannot read file: {exc}")

    try:
        schema = validate_schema(raw_df)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=f"Schema validation failed: {exc}")

    df = standardize_column_names(raw_df, schema["matched_fields"])
    df = standardize_data_types(df)

    # ── M2: Clean ─────────────────────────────────────────────────────────────
    try:
        cleaned_df, cleaning_report = clean_data(df)
    except Exception as exc:
        raise HTTPException(status_code=422, detail=f"Data cleaning failed: {exc}")

    if cleaned_df.empty:
        raise HTTPException(status_code=422, detail="Dataset is empty after cleaning.")

    # ── M3: KPIs ──────────────────────────────────────────────────────────────
    try:
        kpis = calculate_all_kpis(cleaned_df)
    except Exception as exc:
        raise HTTPException(status_code=422, detail=f"KPI calculation failed: {exc}")

    # Serialise KPIs early — contains pandas Series that need conversion
    kpis_json = _to_serialisable(kpis)

    # ── M4: Trend & Seasonality ───────────────────────────────────────────────
    trend_results = None
    trend_json    = None
    trend_error   = None
    try:
        trend_results = analyze_trend_seasonality(kpis["monthly_revenue"])
        trend_json    = _to_serialisable(trend_results)
    except Exception as exc:
        trend_error = str(exc)

    # ── M5: Anomaly Detection ─────────────────────────────────────────────────
    # Detect anomalies at ORDER level when order_id exists (datasets contain
    # multiple product rows per order — row-level detection would be wrong).
    anomaly_summary = {}
    anomaly_records = []
    try:
        anomaly_summary, anomaly_records = _detect_anomalies_with_records(cleaned_df)
    except Exception as exc:
        raise HTTPException(status_code=422, detail=f"Anomaly detection failed: {exc}")

    # ── M6: Cross-module aggregator ───────────────────────────────────────────
    module_outputs = None
    if trend_results is not None:
        try:
            module_outputs = aggregate_module_outputs(kpis, trend_results, anomaly_summary)
            module_outputs = _to_serialisable(module_outputs)
        except Exception:
            pass

    # ── M7: Filter options ────────────────────────────────────────────────────
    filter_options = {}
    try:
        filter_options = get_filter_options(cleaned_df)
        filter_options = _to_serialisable(filter_options)
    except Exception:
        pass

    # ── M8: Visualisation data ────────────────────────────────────────────────
    viz_data = {}
    if trend_results is not None:
        try:
            viz_data = prepare_visualization_data(kpis, trend_results, anomaly_summary)
            viz_data = _to_serialisable(viz_data)
        except Exception as exc:
            viz_data = {"error": str(exc)}

    # ── M9: Alerts ────────────────────────────────────────────────────────────
    alerts = []
    try:
        alerts = generate_alerts(anomaly_summary)
    except Exception:
        pass

    # ── M10: Business insights (orders, best sellers, peak hours,
    #          customer analytics, forecast, profitability, risks/recs) ──────
    insights = {}
    try:
        insights = generate_business_insights(cleaned_df, kpis, anomaly_summary)
        insights = _to_serialisable(insights)
    except Exception as exc:
        insights = {"error": str(exc)}

    # ── Build chart-ready data for the frontend ───────────────────────────────

    # Monthly revenue chart  [{month, revenue}]
    monthly_revenue_series = kpis.get("monthly_revenue")
    revenue_chart = []
    if monthly_revenue_series is not None and not monthly_revenue_series.empty:
        for period, val in monthly_revenue_series.items():
            revenue_chart.append({
                "month": str(period),
                "revenue": float(val) if val is not None and not np.isnan(float(val)) else 0,
            })

    # Monthly rolling avg  [{month, rolling}]
    rolling_avg_series = kpis.get("rolling_average")
    rolling_chart = []
    if rolling_avg_series is not None:
        for period, val in rolling_avg_series.items():
            rolling_chart.append({
                "month": str(period),
                "rolling_avg": None if (val is None or (isinstance(val, float) and np.isnan(val))) else float(val),
            })

    # Sales by category  [{category, sales}]
    category_chart = []
    sbc = kpis.get("sales_by_category")
    if sbc is not None and isinstance(sbc, pd.Series) and not sbc.empty:
        for cat, val in sbc.items():
            category_chart.append({"category": str(cat), "sales": float(val)})

    # Sales by region  [{region, sales}]
    region_chart = []
    sbr = kpis.get("sales_by_region")
    if sbr is not None and isinstance(sbr, pd.Series) and not sbr.empty:
        for reg, val in sbr.items():
            region_chart.append({"region": str(reg), "sales": float(val)})

    # MoM growth  [{month, growth_pct}]
    mom_chart = []
    mom = kpis.get("mom_growth")
    if mom is not None:
        for period, val in mom.items():
            mom_chart.append({
                "month": str(period),
                "growth_pct": None if (val is None or (isinstance(val, float) and np.isnan(val))) else float(val),
            })

    # Trend chart (from M4)
    trend_chart = []
    if trend_results is not None and not trend_results.empty:
        for ts, row in trend_results.iterrows():
            trend_chart.append({
                "month": str(ts),
                "actual": float(row["actual_revenue"]) if not np.isnan(float(row["actual_revenue"])) else None,
                "trend":  float(row["trend"]) if not np.isnan(float(row["trend"])) else None,
                "seasonal": float(row["seasonal"]) if not np.isnan(float(row["seasonal"])) else None,
            })

    # ── Serialise cleaning report ─────────────────────────────────────────────
    cr = {}
    if isinstance(cleaning_report, dict):
        for k, v in cleaning_report.items():
            cr[k] = _to_serialisable(v)

    # ── Final payload ─────────────────────────────────────────────────────────
    payload = {
        "status": "success",
        "meta": {
            "business_id": business_id,
            "user_id": user_id,
            "filename": filename,
            "total_records": len(raw_df),
            "cleaned_records": len(cleaned_df),
            "columns": cleaned_df.columns.tolist(),
            "available_fields": schema.get("matched_fields", {}),
        },
        "cleaning_report": cr,
        "kpis": {
            "total_revenue":       kpis_json.get("total_revenue"),
            "customer_count":      kpis_json.get("customer_count"),
            "profit_margin":       kpis_json.get("profit_margin"),
            "average_order_value": kpis_json.get("average_order_value"),
        },
        "anomaly_summary": _to_serialisable(anomaly_summary),
        "anomaly_records": _to_serialisable(anomaly_records),
        "alerts": _to_serialisable(alerts),
        "insights": insights,
        "processed_at": pd.Timestamp.now().isoformat(),
        "filter_options": filter_options,
        "charts": {
            "revenue":      revenue_chart,
            "rolling_avg":  rolling_chart,
            "category":     category_chart,
            "region":       region_chart,
            "mom_growth":   mom_chart,
            "trend":        trend_chart,
        },
        "trend_error": trend_error,
        "module_outputs": module_outputs,
    }

    return JSONResponse(content=payload)


# ── Filtered re-run (M7 personalisation) ──────────────────────────────────────

@app.post("/filter")
async def filter_dataset(
    file: UploadFile = File(...),
    region: str = Form(default=""),
    category: str = Form(default=""),
    start_date: str = Form(default=""),
    end_date: str = Form(default=""),
):
    """Re-run KPI pipeline on a filtered slice of the uploaded data."""
    from Module_7.personalization_filtering import filter_data

    raw_bytes = await file.read()
    filename  = file.filename or "upload.csv"

    raw_df = _load_df_from_upload(raw_bytes, filename)
    schema = validate_schema(raw_df)
    df     = standardize_column_names(raw_df, schema["matched_fields"])
    df     = standardize_data_types(df)
    cleaned_df, _ = clean_data(df)

    # Apply filters
    kwargs = {}
    if region:    kwargs["region"]     = region
    if category:  kwargs["category"]   = category
    if start_date: kwargs["start_date"] = start_date
    if end_date:   kwargs["end_date"]   = end_date

    try:
        filtered_df = filter_data(cleaned_df, **kwargs)
    except Exception as exc:
        raise HTTPException(status_code=422, detail=str(exc))

    if filtered_df.empty:
        raise HTTPException(status_code=404, detail="No records match the selected filters.")

    kpis     = calculate_all_kpis(filtered_df)
    kpis_ser = _to_serialisable(kpis)

    # category & region charts for filtered view
    category_chart = []
    sbc = kpis.get("sales_by_category")
    if sbc is not None and isinstance(sbc, pd.Series):
        for cat, val in sbc.items():
            category_chart.append({"category": str(cat), "sales": float(val)})

    region_chart = []
    sbr = kpis.get("sales_by_region")
    if sbr is not None and isinstance(sbr, pd.Series):
        for reg, val in sbr.items():
            region_chart.append({"region": str(reg), "sales": float(val)})

    revenue_chart = []
    mr = kpis.get("monthly_revenue")
    if mr is not None:
        for period, val in mr.items():
            revenue_chart.append({"month": str(period), "revenue": float(val)})

    return JSONResponse(content={
        "status": "success",
        "record_count": len(filtered_df),
        "kpis": {
            "total_revenue":       kpis_ser.get("total_revenue"),
            "customer_count":      kpis_ser.get("customer_count"),
            "profit_margin":       kpis_ser.get("profit_margin"),
            "average_order_value": kpis_ser.get("average_order_value"),
        },
        "charts": {
            "revenue":  revenue_chart,
            "category": category_chart,
            "region":   region_chart,
        },
    })
