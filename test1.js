require("dotenv").config();
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const pdfParse = require("pdf-parse");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const { connectDB } = require("./config/dbConnection");
const Pdf = require("./model/pdf");
const PdfChunk = require("./model/PdfChunk");
const {getWeatherTemp} = require("./function")

const app = express();

// Uploads directory
const uploadDir = path.join(process.cwd(), "uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Multer setup
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "uploads/"),
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, `${uniqueSuffix}-${file.originalname}`);
  },
});
const upload = multer({ storage });

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

// Gemini setup
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// In-memory stores
const hospitalDocs = new Map();
const expenseDB = new Map();

// Extract PDF text
async function extractPDFText(buffer) {
  try {
    const data = await pdfParse(buffer);
    return data.text;
  } catch (err) {
    console.error("PDF parsing error:", err);
    return "";
  }
}

function cosineSimilarity(a, b) {
  let dot = 0.0;
  let normA = 0.0;
  let normB = 0.0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

// Create Gemini chat model
function createChat(modelName = "gemini-1.5-flash") {
  const model = genAI.getGenerativeModel({
    model: modelName,
    systemInstruction: {
      parts: [
        {
          text:
            "You are an AI assistant named Vishu. Say 'I am Dovetail assistant, how can I help you?' when asked about your identity. " +
            "Use tools for weather or expenses. Current date: " +
            new Date().toUTCString(),
        },
      ],
    },
    tools:[
      {
        functionDeclarations:[
          {
            name:"getWetherTemp",
            parameters:{
              type:"OBJECT",
              properties:{
                city:{
                  type:"STRING",description:"City name"
                }
              },
              required: ["city"],
            }
          }
        ]
      }
    ]
    // inside below define tools
  });

  return model.startChat();
}

// WebSocket setup
io.on("connection", (socket) => {
  console.log(`🔌 User connected: ${socket.id}`);
  let chatSession = createChat();

 socket.on("userMessage", async (msg) => {
  try {
    const embedModel = genAI.getGenerativeModel({ model: "embedding-001" });
    const embedResult = await embedModel.embedContent({
      content: { parts: [{ text: msg }] },
      taskType: "retrieval_query",
    });
    const userVector = embedResult.embedding.values;

    const chunks = await PdfChunk.findAll({});

    if (chunks.length === 0) {
      socket.emit("botMessage", "I couldn't find any uploaded documents. Please upload a PDF first.");
      return;
    }

    const scored = [];
    for (const chunk of chunks) {
      try {
        const bufferData = chunk.embedding;
        const floatArray = new Float32Array(
          bufferData.buffer.slice(
            bufferData.byteOffset,
            bufferData.byteOffset + bufferData.byteLength
          )
        );
        const chunkVector = Array.from(floatArray);
        const score = cosineSimilarity(userVector, chunkVector);
        scored.push({ chunk, score });
      } catch (err) {
        console.error("Error processing chunk:", err);
      }
    }

    const topChunks = scored.sort((a, b) => b.score - a.score).slice(0, 3);

    if (topChunks.length === 0) {
      socket.emit("botMessage", "I couldn't find relevant information in your documents.");
      return;
    }

    const contextText = topChunks
      .map((c) => `[Document excerpt]: ${c.chunk.content}`)
      .join("\n\n");

    const prompt = `Answer the user's question based EXCLUSIVELY on the following context:\n${contextText}\n\nUser question: ${msg}`;

    const result = await chatSession.sendMessage(prompt); // ✅ FIXED
    socket.emit("botMessage", result.response.text());

  } catch (err) {
    console.error("Chat error:", err);
    socket.emit("botMessage", "⚠️ Error processing your request.");
  }
});


  socket.on("disconnect", () => {
    console.log(`❌ Disconnected: ${socket.id}`);
    hospitalDocs.delete(socket.id);
    expenseDB.delete(socket.id);
  });
});




const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  connectDB();
  console.log(`✅ Server running at http://localhost:${PORT}`);
});
