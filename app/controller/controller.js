const {generateEmbeddingsForPdf} = require('../../util/generateEmbeddingsForPdf');
const Pdf = require("../../model/pdf");
const PdfChunk = require("../../model/PdfChunk");


exports.uploadPdf = async(req,res)=>{
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
  }
};

exports.deleteData = async(req,res)=>{
     try {
    const item = await Pdf.destroy({ where: {} });
    // Deletes all rows from Pdf table
    const item2 = await PdfChunk.destroy({ where: {} });
    // Deletes all rows from PdfChunk table

    console.log(item, item2);

    res.status(200).json({ message: "All data deleted successfully." });
  } catch (error) {
    console.error("Error deleting data:", error);
  }
}