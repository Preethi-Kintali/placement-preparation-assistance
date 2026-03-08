require("dotenv").config();

const express = require("express");
const cors = require("cors");
const analyzeRoute = require("./src/routes/analyzeRoute");

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json({ limit: "1mb" }));

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.use("/api/analyze", analyzeRoute);

app.use((err, _req, res, _next) => {
  const statusCode = err.statusCode || 500;
  const message = err.message || "Internal server error";

  res.status(statusCode).json({
    error: message,
  });
});

app.listen(PORT, () => {
  console.log(`ATS backend running on port ${PORT}`);
});
