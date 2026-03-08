const { calculateModelSimilarity } = require("./mlModelService");

async function calculateSemanticSimilarity(resumeText = "", jdText = "") {
  const similarity = await calculateModelSimilarity(resumeText, jdText);
  return similarity.score;
}

module.exports = {
  calculateSemanticSimilarity,
};
