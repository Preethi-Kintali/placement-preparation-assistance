const fs = require("fs/promises");
const path = require("path");
const { parse } = require("csv-parse/sync");

let datasetKeywordSet = new Set();
let loaded = false;

function cleanToken(token) {
  return token.toLowerCase().replace(/[^a-z0-9]/g, "").trim();
}

function collectKeywordsFromText(text, targetSet) {
  text
    .toLowerCase()
    .split(/\s+/)
    .map(cleanToken)
    .filter((token) => token.length >= 3)
    .forEach((token) => targetSet.add(token));
}

async function readCsvIfExists(filePath) {
  try {
    return await fs.readFile(filePath, "utf8");
  } catch (_error) {
    return "";
  }
}

async function loadDatasetKeywords() {
  if (loaded) {
    return datasetKeywordSet;
  }

  const rootDir = path.resolve(__dirname, "../../..");
  const resumeCsvPath = path.join(rootDir, "software_resumes_1000.csv");
  const jdCsvPath = path.join(rootDir, "software_job_descriptions_1000.csv");

  const [resumeCsv, jdCsv] = await Promise.all([
    readCsvIfExists(resumeCsvPath),
    readCsvIfExists(jdCsvPath),
  ]);

  const keywordSet = new Set();

  for (const rawCsv of [resumeCsv, jdCsv]) {
    if (!rawCsv) {
      continue;
    }

    const rows = parse(rawCsv, {
      columns: true,
      skip_empty_lines: true,
      relax_quotes: true,
    });

    for (const row of rows) {
      const values = Object.values(row);
      values.forEach((value) => {
        if (typeof value === "string") {
          collectKeywordsFromText(value, keywordSet);
        }
      });
    }
  }

  datasetKeywordSet = keywordSet;
  loaded = true;
  return datasetKeywordSet;
}

module.exports = {
  loadDatasetKeywords,
};
