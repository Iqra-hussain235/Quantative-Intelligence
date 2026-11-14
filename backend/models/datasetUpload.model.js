/**
 * datasetUpload.model.js
 * Tracks every file uploaded by a user for a specific business.
 * The actual ML results are stored in ml_results.
 */
import { DataTypes, Model } from "sequelize";
import { sequelize }        from "../config/db.js";

class DatasetUpload extends Model {}

DatasetUpload.init(
  {
    id: {
      type:          DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey:    true,
    },
    businessId: {
      type:      DataTypes.INTEGER,
      allowNull: false,
    },
    userId: {
      type:      DataTypes.INTEGER,
      allowNull: false,
    },
    originalName: {
      type:      DataTypes.TEXT,
      allowNull: false,
    },
    storedFilename: {
      type:      DataTypes.TEXT,
      allowNull: false,
    },
    filePath: {
      type:      DataTypes.TEXT,
      allowNull: false,
    },
    mimeType: {
      type:      DataTypes.TEXT,
      allowNull: true,
    },
    sizeBytes: {
      type:      DataTypes.BIGINT,
      allowNull: true,
    },
    status: {
      // pending | processing | done | error
      type:         DataTypes.ENUM("pending", "processing", "done", "error"),
      allowNull:    false,
      defaultValue: "pending",
    },
    errorMessage: {
      type:      DataTypes.TEXT,
      allowNull: true,
    },
    totalRecords: {
      type:      DataTypes.INTEGER,
      allowNull: true,
    },
    cleanedRecords: {
      type:      DataTypes.INTEGER,
      allowNull: true,
    },
  },
  {
    sequelize,
    modelName: "DatasetUpload",
    tableName: "dataset_uploads",
    timestamps: true,
  }
);

export default DatasetUpload;
