require("dotenv").config();
const { Sequelize } = require("sequelize");

// Create Sequelize instance using DATABASE_URL
const sequelize = new Sequelize("postgresql://chatboat_user:z4rVoOsivJcwKbxlF6AnLEv0hmajcJlD@dpg-d1suiummcj7s73auoe70-a.singapore-postgres.render.com/chatboat", {
  dialect: "postgres",
  logging: false,
  dialectOptions: {
    ssl: { // Required for Render connections
      require: true,
      rejectUnauthorized: false
    }
  }
});

const connectDB = async () => {
  try {
    await sequelize.authenticate();
    console.log("✅ Database connected successfully.");
    
    // Remove sync() in production! Use migrations instead.
    if (process.env.NODE_ENV !== "production") {
      await sequelize.sync();
      console.log("✅ Dev models synchronized.");
    }
  } catch (err) {
    console.error("❌ FATAL DB CONNECTION ERROR:", err.message);
    process.exit(1); // Exit process on connection failure
  }
};

module.exports = { connectDB, sequelize };




// require("dotenv").config();
// const { Sequelize } = require("sequelize");

// const sequelize = new Sequelize(process.env.DB_NAME, process.env.DB_USER, process.env.DB_PASSWORD, {
//   host: process.env.DB_HOST,
//   port: process.env.DB_PORT || 5432,
//   dialect: "postgres",
//   logging: false,
//   dialectOptions: process.env.NODE_ENV === 'production' ? {
//     ssl: {
//       require: true,
//       rejectUnauthorized: false, // needed for Render
//     }
//   } : {},
// });

// const connectDB = async () => {
//   try {
//     await sequelize.authenticate();
//     console.log("✅ Database connected successfully.");
//     await sequelize.sync();
//     console.log("✅ All models synchronized.");
//   } catch (err) {
//     console.error("❌ DB error:", err);
//   }
// };

// module.exports = { connectDB, sequelize };
