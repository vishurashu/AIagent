// In-memory storage for expenses
const expenseDB = new Map();

module.exports = {
  // ✅ Get static weather temperature for some cities
  async getWeatherTemp(city = "") {
    const c = city.toLowerCase();
    if (c === "patiala") return "10°C";
    if (c === "amritsar") return "12°C";
    if (c === "mohali") return "11°C";
    if (c === "delhi") return "15°C";
    if (c === "bangalore" || c === "bengaluru") return "25°C";
    return "N/A";
  },

  // ✅ Add an expense entry to the socket session
  addExpense(socketId, amount) {
    const current = expenseDB.get(socketId) || 0;
    const total = current + amount;
    expenseDB.set(socketId, total);
    return total;
  },

  // ✅ Get total expense for a socket session
  getTotalExpense(socketId) {
    return expenseDB.get(socketId) || 0;
  },

  // Optional: clear expenses for a disconnected socket
  clearExpenses(socketId) {
    expenseDB.delete(socketId);
  }
};
