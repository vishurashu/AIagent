require("dotenv").config();
const { Sequelize } = require("sequelize");

const sequelize = new Sequelize(process.env.DB_NAME, process.env.DB_USER, process.env.DB_PASSWORD, {
  host: process.env.DB_HOST,
  port: process.env.DB_PORT || 5432,
  dialect: "postgres",
  logging: false,
  dialectOptions: process.env.NODE_ENV === 'production' ? {
    ssl: {
      require: true,
      rejectUnauthorized: false, // needed for Render
    }
  } : {},
});

const connectDB = async () => {
  try {
    await sequelize.authenticate();
    console.log("✅ Database connected successfully.");
    await sequelize.sync();
    console.log("✅ All models synchronized.");
  } catch (err) {
    console.error("❌ DB error:", err);
  }
};

module.exports = { connectDB, sequelize };
