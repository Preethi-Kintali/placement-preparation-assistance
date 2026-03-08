const stopWords = require("../config/stopwords");

function normalizeText(text = "") {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenize(text = "") {
  if (!text) {
    return [];
  }

  return text.split(" ").filter(Boolean);
}

function removeStopWords(tokens = []) {
  return tokens.filter((token) => !stopWords.has(token));
}

function preprocessText(text = "") {
  const normalized = normalizeText(text);
  const tokens = tokenize(normalized);
  const filteredTokens = removeStopWords(tokens);

  return {
    normalized,
    tokens,
    filteredTokens,
    cleanedText: filteredTokens.join(" "),
  };
}

module.exports = {
  preprocessText,
};
