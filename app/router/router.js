const express = require("express");
const multer = require("multer");
const router = express.Router();
const Controller = require("../controller/controller")

// Multer setup
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "uploads/"),
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, `${uniqueSuffix}-${file.originalname}`);
  },
});
const upload = multer({ storage });

router.post("/upload-pdf", upload.single("pdf"), Controller.uploadPdf);
router.post("/delete", Controller.deleteData);

module.exports = router;