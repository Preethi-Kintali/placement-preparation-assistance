const natural = require("natural");

const baseStopWords = new Set(natural.stopwords);

const domainNeutralWords = [
  "curriculum",
  "vitae",
  "resume",
  "candidate",
  "work",
  "working",
  "role",
  "responsible",
  "strong",
  "good",
  "excellent",
  "ability",
  "knowledge",
  "year",
  "years",
];

for (const word of domainNeutralWords) {
  baseStopWords.add(word);
}

module.exports = baseStopWords;
