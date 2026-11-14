import { DataTypes, Model } from "sequelize";
import { sequelize } from "../config/db.js";

/**
 * BusinessRecord — normalized transactional line item.
 *
 * One row per product line inside an order (or per record for datasets
 * without order_id). Rows are accumulated across every successful import
 * for a business; re-uploading overlapping/corrected data updates the
 * existing row identified by (businessId, dedupeKey) instead of duplicating.
 */
class BusinessRecord extends Model {}

BusinessRecord.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    businessId: { type: DataTypes.INTEGER, allowNull: false },
    userId:     { type: DataTypes.INTEGER, allowNull: false },
    importId:   { type: DataTypes.INTEGER, allowNull: true },

    // Stable identity of this line across imports — used for dedup/upsert.
    dedupeKey:  { type: DataTypes.TEXT, allowNull: false },

    orderId:        { type: DataTypes.TEXT,   allowNull: true },
    orderDate:      { type: DataTypes.DATEONLY, allowNull: true },
    orderTime:      { type: DataTypes.TEXT,   allowNull: true },   // "HH:MM:SS" when parseable
    customerId:     { type: DataTypes.TEXT,   allowNull: true },
    productId:      { type: DataTypes.TEXT,   allowNull: true },   // SKU / product code
    productName:    { type: DataTypes.TEXT,   allowNull: true },
    category:       { type: DataTypes.TEXT,   allowNull: true },
    quantity:       { type: DataTypes.DECIMAL(14, 3), allowNull: true },
    unitPrice:      { type: DataTypes.DECIMAL(14, 2), allowNull: true },
    sales:          { type: DataTypes.DECIMAL(14, 2), allowNull: true },
    cost:           { type: DataTypes.DECIMAL(14, 2), allowNull: true },
    profit:         { type: DataTypes.DECIMAL(14, 2), allowNull: true },
    paymentMethod:  { type: DataTypes.TEXT,   allowNull: true },
    orderType:      { type: DataTypes.TEXT,   allowNull: true },
    orderStatus:    { type: DataTypes.TEXT,   allowNull: true },
    city:           { type: DataTypes.TEXT,   allowNull: true },
    currency:       { type: DataTypes.TEXT,   allowNull: true },
  },
  {
    sequelize,
    modelName: "BusinessRecord",
    tableName: "business_records",
    timestamps: true,
    indexes: [
      { unique: true, fields: ["businessId", "dedupeKey"] },
      { fields: ["businessId", "orderDate"] },
      { fields: ["businessId", "customerId"] },
      { fields: ["businessId", "productName"] },
    ],
  }
);

export default BusinessRecord;
