const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/dbConnection'); // adjust the path

const PDF = sequelize.define('PDF', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  pdf: {
    type: DataTypes.STRING,
    allowNull: false,
  },
},
{
 // Changed from "posts" to "categories"
            timestamps: true,
}
);

module.exports = PDF;
