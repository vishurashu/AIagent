require("dotenv").config();
const { GoogleGenerativeAI } = require("@google/generative-ai");
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
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

module.exports = generateEmbeddingsForPdf