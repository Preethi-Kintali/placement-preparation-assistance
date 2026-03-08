const fs = require("fs/promises");
const path = require("path");
const { parse } = require("csv-parse/sync");
const cosineSimilarity = require("compute-cosine-similarity");

const MODEL_PATH = path.resolve(__dirname, "../models/ats-model.json");

let cachedModel = null;

function normalizeText(text = "") {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenize(text = "") {
  return normalizeText(text)
    .split(" ")
    .filter((token) => token.length >= 2);
}

function rowToText(row) {
  return Object.values(row)
    .filter((value) => typeof value === "string")
    .join(" ");
}

function safeParseCsv(csvText) {
  if (!csvText) {
    return [];
  }

  return parse(csvText, {
    columns: true,
    skip_empty_lines: true,
    relax_quotes: true,
  });
}

function documentToTf(tokens, vocabularyMap) {
  const vector = Array(vocabularyMap.size).fill(0);
  if (!tokens.length) {
    return vector;
  }

  const counts = new Map();
  for (const token of tokens) {
    counts.set(token, (counts.get(token) || 0) + 1);
  }

  for (const [token, count] of counts) {
    const idx = vocabularyMap.get(token);
    if (idx !== undefined) {
      vector[idx] = count / tokens.length;
    }
  }

  return vector;
}

function applyIdf(tfVector, idf) {
  return tfVector.map((value, index) => value * (idf[index] || 0));
}

function averageVectors(vectors) {
  if (!vectors.length) {
    return [];
  }

  const length = vectors[0].length;
  const avg = Array(length).fill(0);

  for (const vector of vectors) {
    for (let i = 0; i < length; i += 1) {
      avg[i] += vector[i];
    }
  }

  return avg.map((value) => value / vectors.length);
}

function minMaxNormalize(value, min, max) {
  if (max <= min) {
    return 0;
  }

  const normalized = ((value - min) / (max - min)) * 100;
  return Math.max(0, Math.min(100, Math.round(normalized * 100) / 100));
}

async function readDatasets() {
  const rootDir = path.resolve(__dirname, "../../..");
  const resumeCsvPath = path.join(rootDir, "software_resumes_1000.csv");
  const jdCsvPath = path.join(rootDir, "software_job_descriptions_1000.csv");

  const [resumeCsv, jdCsv] = await Promise.all([
    fs.readFile(resumeCsvPath, "utf8"),
    fs.readFile(jdCsvPath, "utf8"),
  ]);

  const resumeRows = safeParseCsv(resumeCsv);
  const jdRows = safeParseCsv(jdCsv);

  const resumeDocs = resumeRows.map((row) => rowToText(row)).map(normalizeText);
  const jdDocs = jdRows.map((row) => rowToText(row)).map(normalizeText);

  return { resumeDocs, jdDocs };
}

async function trainAndSaveModel() {
  const { resumeDocs, jdDocs } = await readDatasets();
  const allDocs = [...resumeDocs, ...jdDocs];

  if (!allDocs.length) {
    throw new Error("No dataset documents found for model training.");
  }

  const docTokens = allDocs.map((doc) => tokenize(doc));

  const df = new Map();
  for (const tokens of docTokens) {
    const unique = new Set(tokens);
    unique.forEach((term) => df.set(term, (df.get(term) || 0) + 1));
  }

  const totalDocs = allDocs.length;
  const sortedTerms = [...df.entries()]
    .filter(([, freq]) => freq >= 3)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4000)
    .map(([term]) => term);

  const vocabularyMap = new Map(sortedTerms.map((term, index) => [term, index]));
  const idf = sortedTerms.map((term) => {
    const termDf = df.get(term) || 1;
    return Math.log((1 + totalDocs) / (1 + termDf)) + 1;
  });

  const resumeVectors = resumeDocs.map((doc) => {
    const tf = documentToTf(tokenize(doc), vocabularyMap);
    return applyIdf(tf, idf);
  });

  const jdVectors = jdDocs.map((doc) => {
    const tf = documentToTf(tokenize(doc), vocabularyMap);
    return applyIdf(tf, idf);
  });

  const resumeCentroid = averageVectors(resumeVectors);
  const jdCentroid = averageVectors(jdVectors);

  const similaritySamples = [];
  const sampleCount = Math.min(resumeVectors.length, jdVectors.length, 300);

  for (let i = 0; i < sampleCount; i += 1) {
    const sim = cosineSimilarity(resumeVectors[i], jdVectors[i]);
    if (Number.isFinite(sim)) {
      similaritySamples.push(sim);
    }
  }

  const simMin = similaritySamples.length ? Math.min(...similaritySamples) : 0;
  const simMax = similaritySamples.length ? Math.max(...similaritySamples) : 1;

  const model = {
    version: 1,
    trainedAt: new Date().toISOString(),
    vocabulary: sortedTerms,
    idf,
    stats: {
      totalDocs,
      resumeCount: resumeDocs.length,
      jdCount: jdDocs.length,
      simMin,
      simMax,
    },
    centroids: {
      resume: resumeCentroid,
      jd: jdCentroid,
    },
  };

  await fs.writeFile(MODEL_PATH, JSON.stringify(model), "utf8");
  cachedModel = model;
  return model;
}

async function ensureModelLoaded() {
  if (cachedModel) {
    return cachedModel;
  }

  try {
    const raw = await fs.readFile(MODEL_PATH, "utf8");
    cachedModel = JSON.parse(raw);
    return cachedModel;
  } catch (_error) {
    return trainAndSaveModel();
  }
}

async function vectorizeText(text = "") {
  const model = await ensureModelLoaded();
  const vocabularyMap = new Map(model.vocabulary.map((term, index) => [term, index]));
  const tf = documentToTf(tokenize(text), vocabularyMap);
  return applyIdf(tf, model.idf);
}

async function calculateModelSimilarity(resumeText = "", jdText = "") {
  if (!resumeText || !jdText) {
    return {
      score: 0,
      raw: 0,
    };
  }

  const model = await ensureModelLoaded();
  const [resumeVector, jdVector] = await Promise.all([
    vectorizeText(resumeText),
    vectorizeText(jdText),
  ]);

  const raw = cosineSimilarity(resumeVector, jdVector);
  if (!Number.isFinite(raw) || raw < 0) {
    return {
      score: 0,
      raw: 0,
    };
  }

  const score = minMaxNormalize(raw, model.stats.simMin, model.stats.simMax);
  return {
    score,
    raw: Math.round(raw * 10000) / 10000,
  };
}

async function calculateResumeModelQuality(resumeText = "") {
  const model = await ensureModelLoaded();
  const resumeVector = await vectorizeText(resumeText);
  const centroidRaw = cosineSimilarity(resumeVector, model.centroids.resume);

  if (!Number.isFinite(centroidRaw) || centroidRaw < 0) {
    return 0;
  }

  return minMaxNormalize(centroidRaw, 0, 1);
}

async function getModelInfo() {
  const model = await ensureModelLoaded();
  return {
    trainedAt: model.trainedAt,
    vocabularySize: model.vocabulary.length,
    resumeCount: model.stats.resumeCount,
    jdCount: model.stats.jdCount,
  };
}

module.exports = {
  trainAndSaveModel,
  ensureModelLoaded,
  calculateModelSimilarity,
  calculateResumeModelQuality,
  getModelInfo,
};
