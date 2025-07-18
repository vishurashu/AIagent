const Sequelize = require('sequelize');

// Connect to the 'chatboat' database
const sequelize = new Sequelize('chatboat', 'postgres', 'Vishu@12345', {
  host: 'localhost',
  dialect: 'postgres',
  logging: false,
});

const connectDB = async () => {
  try {
    await sequelize.authenticate();
    console.log('Database connection has been established successfully.');
    await sequelize.sync();
    console.log('All models were synchronized successfully.');
  } catch (err) {
    console.error('DB error:', err);
  }
};

module.exports = { connectDB, sequelize };
