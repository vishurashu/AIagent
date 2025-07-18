const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/dbConnection'); // Ensure path is correct

const PdfChunk = sequelize.define("PdfChunk", {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  pdfId: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  content: {
    type: DataTypes.TEXT,
    allowNull: false,
  },
  embedding: {
    type: DataTypes.BLOB, // Consider BLOB or ARRAY depending on use
    allowNull: true,       // Optional: set to false if always required
  },
  pageNumber: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  chunkIndex: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
}, {
  timestamps: true,
  tableName: 'pdf_chunks', // Optional: specify table name
});

module.exports = PdfChunk;
