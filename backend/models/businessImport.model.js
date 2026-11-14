import { DataTypes, Model } from "sequelize";
import { sequelize } from "../config/db.js";

/**
 * BusinessImport — import history for a business's accumulated records.
 * One row per uploaded file that was parsed into BusinessRecord rows.
 */
class BusinessImport extends Model {}

BusinessImport.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    businessId:       { type: DataTypes.INTEGER, allowNull: false },
    userId:           { type: DataTypes.INTEGER, allowNull: false },
    datasetUploadId:  { type: DataTypes.INTEGER, allowNull: true },
    fileName:         { type: DataTypes.TEXT,    allowNull: true },
    fileType:         { type: DataTypes.TEXT,    allowNull: true },

    dateRangeStart:   { type: DataTypes.DATEONLY, allowNull: true },
    dateRangeEnd:     { type: DataTypes.DATEONLY, allowNull: true },

    totalRows:        { type: DataTypes.INTEGER, allowNull: true },   // rows parsed from file
    newRows:          { type: DataTypes.INTEGER, allowNull: true },   // inserted
    updatedRows:      { type: DataTypes.INTEGER, allowNull: true },   // corrected existing lines
    duplicateRows:    { type: DataTypes.INTEGER, allowNull: true },   // skipped duplicates

    status:           { type: DataTypes.TEXT, allowNull: true, defaultValue: "completed" }, // completed | failed
    errorMessage:     { type: DataTypes.TEXT, allowNull: true },
  },
  {
    sequelize,
    modelName: "BusinessImport",
    tableName: "business_imports",
    timestamps: true,
  }
);

export default BusinessImport;
