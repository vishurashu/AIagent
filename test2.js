require("dotenv").config();
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const { GoogleGenerativeAI } = require("@google/generative-ai");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" }, // Allow frontend connections
});

// Gemini setup
const genAI = new GoogleGenerativeAI(
  process.env.GEMINI_API_KEY || "AIzaSyDLWf3BMOhqHl5QzsaI9-eimfRmIZgtBPg"
);

const expenseDB = [];

// Tools
function getWetherTemp(city = "") {
  const c = city.toLowerCase();
  if (c === "patiala") return "10°C";
  if (c === "amritsar") return "12°C";
  if (c === "mohali") return "11°C";
  if (c === "delhi") return "15°C";
  if (c === "bangalore" || c === "bengaluru") return "25°C";
  return "N/A";
}

function getTotalExpense({ from, to }) {
  return expenseDB.reduce((acc, item) => acc + Number(item.amount), 0);
}

function addExpense({ name, amount }) {
  expenseDB.push({ name, amount: Number(amount) });
  return "Expense added.";
}

// Create Gemini model with tools
function createChat(modelName = "gemini-1.5-flash") {
  const model = genAI.getGenerativeModel({
    model: modelName,
    systemInstruction: {
      parts: [
        {
          text:
            "You are an AI assistant named Vishu. Say 'I am Dovetail assistant, how can I help you?' when asked about your identity. " +
            "Use tools for weather or expenses. Current date: " + new Date().toUTCString(),
        },
      ],
    },
    tools: [
      {
        functionDeclarations: [
          {
            name: "getWetherTemp",
            parameters: {
              type: "OBJECT",
              properties: {
                city: { type: "STRING", description: "City name" },
              },
              required: ["city"],
            },
          },
          {
            name: "getTotalExpense",
            parameters: {
              type: "OBJECT",
              properties: {
                from: { type: "STRING", description: "Start date" },
                to: { type: "STRING", description: "End date" },
              },
              required: ["from", "to"],
            },
          },
          {
            name: "addExpense",
            parameters: {
              type: "OBJECT",
              properties: {
                name: { type: "STRING", description: "Expense name" },
                amount: { type: "STRING", description: "Expense amount" },
              },
              required: ["name", "amount"],
            },
          },
        ],
      },
    ],
  });

  return model.startChat();
}

// Handle socket connections
io.on("connection", (socket) => {
  console.log(`🔌 User connected: ${socket.id}`);

  let chatSession = createChat(); // Create session per usern

  socket.on("userMessage", async (msg) => {
    try {
      // console.log(">>>>>>>>>>>>first message",msg)
      const result = await chatSession.sendMessage(msg.toString());
      const response = result.response;
      // console.log(">>>>>>>>>>>>first response",response)
      const functionCalls = response.functionCalls();

      if (functionCalls?.length > 0) {
        const functionResponses = [];

        for (const call of functionCalls) {
          const { name, args } = call;

          if (name === "getWetherTemp") {
            const temperature = getWetherTemp(args.city);
            functionResponses.push({
              functionResponse: { name, response: { temperature } },
            });
          } else if (name === "getTotalExpense") {
            const total = getTotalExpense(args);
            functionResponses.push({
              functionResponse: { name, response: { total } },
            });
          } else if (name === "addExpense") {
            const result = addExpense(args);
            functionResponses.push({
              functionResponse: { name, response: { result } },
            });
          }
        }

        const toolResult = await chatSession.sendMessage(functionResponses);
        socket.emit("botMessage", toolResult.response.text());
      } else {
        socket.emit("botMessage", response.text());
      }
    } catch (err) {
      console.error("Gemini error:", err);
      socket.emit("botMessage", "⚠️ I'm facing issues. Try again later.");
    }
  });

  socket.on("disconnect", () => {
    console.log(`❌ Disconnected: ${socket.id}`);
  });
});

// Start the server
const PORT = process.env.PORT || 3000;
// Example route
app.get('/', (req, res) => {
  res.send('Hello from Express!');
});
server.listen(PORT, () => {
  console.log(`✅ Socket server running at http://localhost:${PORT}`);
});