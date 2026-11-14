/**
 * mlResult.model.js
 * Stores the ML pipeline output for a specific dataset upload.
 * One row per upload (updated in-place if re-processed).
 *
 * The `results` JSONB column holds the full payload returned by FastAPI
 * including kpis, charts, anomaly_summary, alerts, cleaning_report.
 */
import { DataTypes, Model } from "sequelize";
import { sequelize }        from "../config/db.js";

class MlResult extends Model {}

MlResult.init(
  {
    id: {
      type:          DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey:    true,
    },
    uploadId: {
      type:      DataTypes.INTEGER,
      allowNull: false,
    },
    businessId: {
      type:      DataTypes.INTEGER,
      allowNull: false,
    },
    userId: {
      type:      DataTypes.INTEGER,
      allowNull: false,
    },
    // Full ML pipeline output stored as JSONB for flexible querying
    results: {
      type:      DataTypes.JSONB,
      allowNull: true,
    },
    // Flattened top-level KPIs for quick SELECT without parsing JSONB
    totalRevenue: {
      type:      DataTypes.DECIMAL(18, 2),
      allowNull: true,
    },
    customerCount: {
      type:      DataTypes.INTEGER,
      allowNull: true,
    },
    profitMargin: {
      type:      DataTypes.DECIMAL(10, 4),
      allowNull: true,
    },
    averageOrderValue: {
      type:      DataTypes.DECIMAL(18, 2),
      allowNull: true,
    },
    anomalyCount: {
      type:      DataTypes.INTEGER,
      allowNull: true,
    },
    anomalyPercentage: {
      type:      DataTypes.DECIMAL(6, 2),
      allowNull: true,
    },
    processedAt: {
      type:      DataTypes.DATE,
      allowNull: true,
    },
  },
  {
    sequelize,
    modelName: "MlResult",
    tableName: "ml_results",
    timestamps: true,
  }
);

export default MlResult;
