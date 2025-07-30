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

const app = express();
app.use(
  cors({
    origin: "*",
    credentials: true,
  })
);
app.use(express.json());
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

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
function makeLinksClickable(text) {
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  return text.replace(urlRegex, (url) => {
    return `<a href="${url}" target="_blank" style="color:#007bff; text-decoration:underline;">${url}</a>`;
  });
}

// Create Gemini chat model
function createChat(modelName = "gemini-2.0-flash-lite") {
  const model = genAI.getGenerativeModel({
    model: modelName,
    systemInstruction: {
      parts: [
        {
          text: `
You are an AI assistant named Vishu, working for Dovetail.
Follow these rules:
- Introduce yourself ONLY if the user asks about your identity.
- Otherwise, answer concisely and naturally.

Here is some company information to keep in mind:
- Pourav Araro is the CEO of Dovetail.
- Rahul Kashyap is the General Manager of Dovetail.
Only use these titles and spellings when asked about them.
- Rahul Kashyap is the General Manager.

Today is: ${new Date().toUTCString()}
          `,
        },
      ],
    },
  });

  return model.startChat();
}


// WebSocket setup
io.on("connection", (socket) => {
  console.log(`🔌 User connected: ${socket.id}`);
  let chatSession = createChat();
  socket.emit("botMessage", "👋 Welcome to Dovetail Ai! How can I help you?");
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
- The correct name is **Pourav Araro**, and he is the **CEO of Dovetail**.
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
    } catch (err) {
      console.error("Chat error:", err);
      socket.emit("botMessage", "processing your request.");
    }
  });

  socket.on("disconnect", () => {
    console.log(`❌ Disconnected: ${socket.id}`);
    hospitalDocs.delete(socket.id);
    expenseDB.delete(socket.id);
  });
});

// Embedding generator
async function generateEmbeddingsForPdf(pdfId) {
  const chunks = await PdfChunk.findAll({ where: { pdfId } });

  const embedModel = genAI.getGenerativeModel({ model: "embedding-001" });

  for (const chunk of chunks) {
    try {
      const result = await embedModel.embedContent({
        content: { parts: [{ text: chunk.content }] },
        taskType: "retrieval_document",
      });

      const embeddingArray = result.embedding.values;
      const float32Buffer = Buffer.from(
        Float32Array.from(embeddingArray).buffer
      );

      await chunk.update({ embedding: float32Buffer });
    } catch (err) {
      console.error("Embedding generation error:", err);
    }
  }
}

// Upload & process PDF route
app.post("/upload-pdf", upload.single("pdf"), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "No PDF uploaded" });
  }
  try {
    const filePath = path.join(uploadDir, req.file.filename);
    const buffer = fs.readFileSync(filePath);
    const text = await extractPDFText(buffer);

    // FIX 2: Store socket ID with PDF
    const item = await Pdf.create({
      pdf: req.file.filename,
      // socketId: socketId,
    });

    // FIX 6: Better chunking with sentence boundaries
    const CHUNK_SIZE = 1000; // Increased chunk size
    const chunks = [];
    let start = 0;

    while (start < text.length) {
      // Find natural break point
      let end = Math.min(start + CHUNK_SIZE, text.length);
      if (end < text.length) {
        // Try to break at sentence end
        const nextPeriod = text.indexOf(".", end);
        const nextNewline = text.indexOf("\n", end);

        if (nextPeriod > -1 && nextPeriod < start + CHUNK_SIZE * 1.2) {
          end = nextPeriod + 1;
        } else if (nextNewline > -1 && nextNewline < start + CHUNK_SIZE * 1.2) {
          end = nextNewline + 1;
        }
      }

      chunks.push({
        pdfId: item.id,
        content: text.substring(start, end).trim(),
        pageNumber: 1,
        chunkIndex: chunks.length,
      });

      start = end;
    }

    await PdfChunk.bulkCreate(chunks);
    await generateEmbeddingsForPdf(item.id);

    res.json({
      message: "PDF processed successfully",
      chunks: chunks.length,
    });
  } catch (error) {
    console.error("PDF processing error:", error);
    res.status(500).json({ error: "Failed to process PDF" });
  }
});

app.post("/delete", async (req, res) => {
  try {
    const item = await Pdf.destroy({ where: {} });
    // Deletes all rows from Pdf table
    const item2 = await PdfChunk.destroy({ where: {} });
    // Deletes all rows from PdfChunk table

    console.log(item, item2);

    res.status(200).json({ message: "All data deleted successfully." });
  } catch (error) {
    console.error("Error deleting data:", error);
    res.status(500).json({ error: "An error occurred while deleting data." });
  }
});

// Root route
app.get("/", (req, res) => {
  res.send("Hello from Express + Gemini + PDF!");
});

// Start the server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  connectDB();
  console.log(`✅ Server running at http://localhost:${PORT}`);
});
