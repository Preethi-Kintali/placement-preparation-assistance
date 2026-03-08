const express = require("express");
const multer = require("multer");
const { analyzeResume } = require("../controllers/analyzeController");

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 7 * 1024 * 1024,
  },
  fileFilter: (_req, file, cb) => {
    const isPdf = file.mimetype === "application/pdf";
    if (!isPdf) {
      cb(new Error("Only PDF files are allowed."));
      return;
    }

    cb(null, true);
  },
});

router.post(
  "/",
  upload.fields([
    { name: "resumePdf", maxCount: 1 },
    { name: "jobDescriptionPdf", maxCount: 1 },
  ]),
  analyzeResume
);

module.exports = router;
