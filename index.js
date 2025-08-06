require("dotenv").config();
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const pdfParse = require("pdf-parse");
const multer = require("multer");
const path = require("path");
const cors = require("cors");
const fs = require("fs");
const { connectDB } = require("./config/dbConnection");
const Pdf = require("./model/pdf");
const PdfChunk = require("./model/PdfChunk");
const cosineSimilarity = require("./util/cosineSimilarity");
const { createChat } = require("./services/geminiService");
const containsServiceIntent = require("./util/containsServiceIntent");
const ContactFlow = require("./util/ContactFlow");
const Router = require("./app/router/router");
const app = express();
app.use(
  cors({
    origin: "*",
    credentials: true,
  })
);
app.use(express.json());
app.use(express.urlencoded({ extended: true, limit: "50mb" }));
app.use("/", Router);
// Uploads directory
const uploadDir = path.join(process.cwd(), "uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

// Gemini setup
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
let isServiceIntent = false;

// WebSocket setup
io.on("connection", (socket) => {
  console.log(`🔌 User connected: ${socket.id}`);
  const contactFlow = new ContactFlow(socket);
  let chatSession = createChat();
  socket.emit("botMessage", "👋 Welcome to Dovetail Ai! How can I help you?");
  // For storing contact flow info
  // let userContactInfo = {};
  // let isServiceIntent = false;
  socket.on("userMessage", async (msg) => {
    try {
      // ✅ Contact info collection flow
     if (contactFlow.isActive) {
      if (await contactFlow.handleMessage(msg)) return;
    }

    // ✅ Detect service intent only if flow is NOT active and NOT submitted
  if (await containsServiceIntent(msg)) {
  if (!contactFlow.hasSubmitted) {
    // Only start contact flow if details not submitted yet
    setTimeout(() => contactFlow.start(), 1500);
    return; // Stop further processing
  }
  // If submitted, just answer normally (do nothing here)
}
      const embedModel = genAI.getGenerativeModel({ model: "embedding-001" });
      const embedResult = await embedModel.embedContent({
        content: { parts: [{ text: msg }] },
        taskType: "retrieval_query",
      });
      const userVector = embedResult.embedding.values;

      const chunks = await PdfChunk.findAll({});

      if (chunks.length === 0) {
        socket.emit(
          "botMessage",
          "I couldn't find any uploaded documents. Please upload a PDF first."
        );
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
        socket.emit(
          "botMessage",
          "I couldn't find relevant information in your documents."
        );
        return;
      }

      const contextText = topChunks
        .map((c) => `[Document excerpt]: ${c.chunk.content}`)
        .join("\n\n");

      const prompt = `
You are a helpful assistant for a company called Dovetail.

Always follow these rules strictly:
- Do **not mention** the name "Purav Jha" under any circumstance. That information is incorrect.
- The correct name is **Pourav Arora**, and he is the **CEO of Dovetail**.
- **Rahul Kashyap** is the **General Manager**.
- Answer ONLY based on the provided context, and speak as if you are part of Dovetail.
- Do not say phrases like "based on the context" or "according to the document."
- Speak as if you are part of the Dovetail team.
- Never say “I don’t have information” or “I’m not sure.”
- If the user asks whether Dovetail has built any type of app or website (e.g., cab booking, e-commerce, food delivery, real estate, etc.), always respond with YES.
- Clearly explain that Dovetail specializes in custom development of all types of mobile applications (Android/iOS), websites, and software (like ERP, CRM, billing systems, etc.).
- Reinforce that Dovetail has expertise in developing and delivering successful software solutions for a wide range of industries.

Context:
${contextText}

User Question: ${msg}
`;

      const result = await chatSession.sendMessage(prompt);
      let botReply = result.response.text();

      // Make all URLs clickable
      botReply = botReply.replace(
        /(https?:\/\/[^\s]+)/g,
        '<a href="$1" target="_blank" style="color:#007bff; text-decoration:underline;">$1</a>'
      );

      socket.emit("botMessage", botReply);
      // ✅ If this was a service intent, start asking for details
      if (isServiceIntent) {
        setTimeout(() => {
          userContactInfo = { step: "askName" };
          socket.emit(
            "botMessage",
            "Great! To proceed further, please share your name."
          );
        }, 1500);

        isServiceIntent = false; // Reset flag
      }
    } catch (err) {
      console.error("Chat error:", err);
      socket.emit("botMessage", "processing your request.");
    }
  });

  socket.on("disconnect", () => {
    console.log(`❌ Disconnected: ${socket.id}`);
    // hospitalDocs.delete(socket.id);
    // expenseDB.delete(socket.id);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  connectDB();
  console.log(`✅ Server running at http://localhost:${PORT}`);
});
