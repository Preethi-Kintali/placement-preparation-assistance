const pdf = require("pdf-parse");

async function extractPdfText(file) {
  if (!file) {
    return "";
  }

  const data = await pdf(file.buffer);
  return (data.text || "").replace(/\s+/g, " ").trim();
}

module.exports = {
  extractPdfText,
};
