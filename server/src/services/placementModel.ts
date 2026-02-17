import fs from "node:fs/promises";
import path from "node:path";
import { parse } from "csv-parse/sync";

export type PlacementFeatures = {
  cgpa: number;
  internships: number;
  projects: number;
  workshopsCertifications: number;
  aptitudeTestScore: number;
  softSkillsRating: number;
  extracurricularActivities: 0 | 1;
  placementTraining: 0 | 1;
  sscMarks: number;
  hscMarks: number;
};

export const PLACEMENT_FEATURES = [
  "CGPA",
  "Internships",
  "Projects",
  "Workshops/Certifications",
  "AptitudeTestScore",
  "SoftSkillsRating",
  "ExtracurricularActivities",
  "PlacementTraining",
  "SSC_Marks",
  "HSC_Marks",
] as const;

type PlacementAlgorithm = "random_forest";

type PlacementModel = {
  algorithm: PlacementAlgorithm;
  // Trees work fine on raw features; keep means/stds for future compatibility.
  means: number[];
  stds: number[];
  forest: Array<TreeNode>;
  trainAccuracy: number;
  accuracy: number;
  holdoutAuc: number;
  confusionMatrix: { tp: number; fp: number; tn: number; fn: number; threshold: number };
  featureImportance: Array<{ feature: (typeof PLACEMENT_FEATURES)[number]; aucDrop: number }>;
  trainedAt: Date;
  sampleCount: number;
};

let cached: PlacementModel | null = null;
let trainingPromise: Promise<PlacementModel> | null = null;

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
}

function sigmoid(z: number) {
  if (z >= 0) {
    const ez = Math.exp(-z);
    return 1 / (1 + ez);
  }
  const ez = Math.exp(z);
  return ez / (1 + ez);
}

function featuresToArray(f: PlacementFeatures): number[] {
  return [
    f.cgpa,
    f.internships,
    f.projects,
    f.workshopsCertifications,
    f.aptitudeTestScore,
    f.softSkillsRating,
    f.extracurricularActivities,
    f.placementTraining,
    f.sscMarks,
    f.hscMarks,
  ];
}

function standardize(x: number[], means: number[], stds: number[]) {
  return x.map((v, i) => (v - means[i]) / (stds[i] || 1));
}

function dot(w: number[], x: number[]) {
  let s = w[0]; // bias
  for (let i = 0; i < x.length; i++) s += w[i + 1] * x[i];
  return s;
}

function seededShuffle<T>(arr: T[], seed = 42): T[] {
  // deterministic Fisher-Yates using LCG
  let state = seed >>> 0;
  const out = arr.slice();
  const rand = () => {
    state = (1664525 * state + 1013904223) >>> 0;
    return state / 0xffffffff;
  };
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function computeMeansStds(xs: number[][]) {
  const dim = xs[0]?.length ?? 0;
  const means = new Array(dim).fill(0);
  const stds = new Array(dim).fill(0);
  for (const x of xs) for (let i = 0; i < dim; i++) means[i] += x[i];
  for (let i = 0; i < dim; i++) means[i] /= xs.length;
  for (const x of xs) for (let i = 0; i < dim; i++) stds[i] += (x[i] - means[i]) ** 2;
  for (let i = 0; i < dim; i++) stds[i] = Math.sqrt(stds[i] / xs.length) || 1;
  return { means, stds };
}

type TreeNode =
  | { leaf: true; prob: number }
  | { leaf: false; featureIndex: number; threshold: number; left: TreeNode; right: TreeNode; prob: number };

function seededRng(seed = 42) {
  let state = seed >>> 0;
  return {
    next: () => {
      state = (1664525 * state + 1013904223) >>> 0;
      return state / 0xffffffff;
    },
    nextInt: (maxExclusive: number) => Math.floor(((state = (1664525 * state + 1013904223) >>> 0) / 0xffffffff) * maxExclusive),
  };
}

function gini(pos: number, total: number) {
  if (total <= 0) return 0;
  const p = pos / total;
  return 2 * p * (1 - p);
}

function pickFeatureSubset(dim: number, mtry: number, rng: { next: () => number }) {
  const features = Array.from({ length: dim }, (_, i) => i);
  // Fisher-Yates partial shuffle
  for (let i = 0; i < mtry; i++) {
    const j = i + Math.floor(rng.next() * (dim - i));
    [features[i], features[j]] = [features[j], features[i]];
  }
  return features.slice(0, mtry);
}

function trainTree(
  xs: number[][],
  ys: number[],
  sampleIdx: number[],
  depth: number,
  maxDepth: number,
  minSamplesSplit: number,
  minSamplesLeaf: number,
  mtry: number,
  rng: { next: () => number }
): TreeNode {
  const n = sampleIdx.length;
  let pos = 0;
  for (const i of sampleIdx) pos += ys[i];
  const prob = n ? pos / n : 0;

  if (depth >= maxDepth || n < minSamplesSplit || pos === 0 || pos === n) {
    return { leaf: true, prob };
  }

  const dim = xs[0]?.length ?? 0;
  const features = pickFeatureSubset(dim, Math.min(mtry, dim), rng);

  let bestFeature = -1;
  let bestThreshold = 0;
  let bestScore = Number.POSITIVE_INFINITY;
  let bestLeft: number[] = [];
  let bestRight: number[] = [];

  for (const f of features) {
    // Collect values for this node
    const vals = sampleIdx.map((i) => xs[i][f]);
    let minV = Number.POSITIVE_INFINITY;
    let maxV = Number.NEGATIVE_INFINITY;
    for (const v of vals) {
      if (v < minV) minV = v;
      if (v > maxV) maxV = v;
    }
    if (minV === maxV) continue;

    // Candidate thresholds at quantiles to keep it fast
    const pairs = sampleIdx
      .map((i) => ({ i, v: xs[i][f] }))
      .sort((a, b) => a.v - b.v);

    const qCount = 18;
    for (let q = 1; q <= qCount; q++) {
      const cut = Math.floor((pairs.length * q) / (qCount + 1));
      const thr = pairs[cut]?.v;
      if (!Number.isFinite(thr)) continue;

      const left: number[] = [];
      const right: number[] = [];
      let leftPos = 0;
      let rightPos = 0;
      for (const { i } of pairs) {
        if (xs[i][f] <= thr) {
          left.push(i);
          leftPos += ys[i];
        } else {
          right.push(i);
          rightPos += ys[i];
        }
      }

      if (left.length < minSamplesLeaf || right.length < minSamplesLeaf) continue;

      const score =
        (left.length / n) * gini(leftPos, left.length) +
        (right.length / n) * gini(rightPos, right.length);

      if (score < bestScore) {
        bestScore = score;
        bestFeature = f;
        bestThreshold = thr;
        bestLeft = left;
        bestRight = right;
      }
    }
  }

  if (bestFeature === -1) {
    return { leaf: true, prob };
  }

  const leftNode = trainTree(xs, ys, bestLeft, depth + 1, maxDepth, minSamplesSplit, minSamplesLeaf, mtry, rng);
  const rightNode = trainTree(xs, ys, bestRight, depth + 1, maxDepth, minSamplesSplit, minSamplesLeaf, mtry, rng);
  return {
    leaf: false,
    featureIndex: bestFeature,
    threshold: bestThreshold,
    left: leftNode,
    right: rightNode,
    prob,
  };
}

function predictTree(node: TreeNode, x: number[]): number {
  let cur: TreeNode = node;
  while (!cur.leaf) {
    cur = x[cur.featureIndex] <= cur.threshold ? cur.left : cur.right;
  }
  return cur.prob;
}

function computeForestAccuracy(forest: TreeNode[], xs: number[][], ys: number[]) {
  let correct = 0;
  for (let i = 0; i < xs.length; i++) {
    let p = 0;
    for (const t of forest) p += predictTree(t, xs[i]);
    p /= forest.length || 1;
    const pred = p >= 0.5 ? 1 : 0;
    if (pred === ys[i]) correct++;
  }
  return correct / xs.length;
}

function predictForestProb(forest: TreeNode[], x: number[]) {
  let p = 0;
  for (const t of forest) p += predictTree(t, x);
  p /= forest.length || 1;
  return clamp(p, 0, 1);
}

function computeConfusion(probs: number[], ys: number[], threshold = 0.5) {
  let tp = 0;
  let fp = 0;
  let tn = 0;
  let fn = 0;
  for (let i = 0; i < probs.length; i++) {
    const pred = probs[i] >= threshold ? 1 : 0;
    const y = ys[i];
    if (pred === 1 && y === 1) tp++;
    else if (pred === 1 && y === 0) fp++;
    else if (pred === 0 && y === 0) tn++;
    else fn++;
  }
  return { tp, fp, tn, fn, threshold };
}

function computeRocAuc(probs: number[], ys: number[]) {
  // ROC-AUC via sorting by probability
  const pairs = probs.map((p, i) => ({ p, y: ys[i] }));
  pairs.sort((a, b) => b.p - a.p);

  let pos = 0;
  let neg = 0;
  for (const it of pairs) {
    if (it.y === 1) pos++;
    else neg++;
  }
  if (pos === 0 || neg === 0) return 0.5;

  let tp = 0;
  let fp = 0;
  let prevTpr = 0;
  let prevFpr = 0;
  let auc = 0;
  let prevP = Number.POSITIVE_INFINITY;

  for (const it of pairs) {
    if (it.p !== prevP) {
      const tpr = tp / pos;
      const fpr = fp / neg;
      auc += (fpr - prevFpr) * (tpr + prevTpr) * 0.5;
      prevTpr = tpr;
      prevFpr = fpr;
      prevP = it.p;
    }
    if (it.y === 1) tp++;
    else fp++;
  }

  // close curve to (1,1)
  const tpr = tp / pos;
  const fpr = fp / neg;
  auc += (fpr - prevFpr) * (tpr + prevTpr) * 0.5;
  return clamp(auc, 0, 1);
}

function permutationImportanceAuc(
  forest: TreeNode[],
  testXs: number[][],
  testYs: number[],
  baselineAuc: number
) {
  const out: Array<{ feature: (typeof PLACEMENT_FEATURES)[number]; aucDrop: number }> = [];

  for (let j = 0; j < PLACEMENT_FEATURES.length; j++) {
    const values = testXs.map((x) => x[j]);
    const perm = seededShuffle(values, 9000 + j);
    const probs: number[] = new Array(testXs.length);
    for (let i = 0; i < testXs.length; i++) {
      const x = testXs[i].slice();
      x[j] = perm[i];
      probs[i] = predictForestProb(forest, x);
    }
    const auc = computeRocAuc(probs, testYs);
    const aucDrop = Math.max(0, baselineAuc - auc);
    out.push({ feature: PLACEMENT_FEATURES[j], aucDrop });
  }

  out.sort((a, b) => b.aucDrop - a.aucDrop);
  return out;
}

function trainRandomForest(xs: number[][], ys: number[], seed: number) {
  const rng = seededRng(seed);
  const n = xs.length;
  const dim = xs[0]?.length ?? 0;

  const treeCount = 80;
  const maxDepth = 8;
  const minSamplesSplit = 10;
  const minSamplesLeaf = 5;
  const mtry = Math.max(2, Math.floor(Math.sqrt(dim)));

  const forest: TreeNode[] = [];
  for (let t = 0; t < treeCount; t++) {
    const boot: number[] = [];
    for (let i = 0; i < n; i++) boot.push(Math.floor(rng.next() * n));
    const idx = boot.map((b) => b);
    const tree = trainTree(xs, ys, idx, 0, maxDepth, minSamplesSplit, minSamplesLeaf, mtry, rng);
    forest.push(tree);
  }
  return forest;
}

export async function getPlacementModel(): Promise<PlacementModel> {
  if (cached) return cached;
  if (trainingPromise) return trainingPromise;

  trainingPromise = (async () => {
    const csvPath = path.resolve(process.cwd(), "..", "placementdata.csv");
    const raw = await fs.readFile(csvPath, "utf-8");

    const rows = parse(raw, { columns: true, skip_empty_lines: true, trim: true }) as any[];
    const samples = rows
      .map((r) => {
        const y = String(r.PlacementStatus || "").trim().toLowerCase() === "placed" ? 1 : 0;
        const extracurricular = String(r["ExtracurricularActivities"] || "").trim().toLowerCase() === "yes" ? 1 : 0;
        const training = String(r["PlacementTraining"] || "").trim().toLowerCase() === "yes" ? 1 : 0;

        const f: PlacementFeatures = {
          cgpa: Number(r.CGPA),
          internships: Number(r.Internships),
          projects: Number(r.Projects),
          workshopsCertifications: Number(r["Workshops/Certifications"]),
          aptitudeTestScore: Number(r.AptitudeTestScore),
          softSkillsRating: Number(r.SoftSkillsRating),
          extracurricularActivities: extracurricular as 0 | 1,
          placementTraining: training as 0 | 1,
          sscMarks: Number(r.SSC_Marks),
          hscMarks: Number(r.HSC_Marks),
        };

        const x = featuresToArray(f).map((n) => (Number.isFinite(n) ? n : 0));
        return { x, y };
      })
      .filter((s) => s.x.every((n) => Number.isFinite(n)) && (s.y === 0 || s.y === 1));

    const shuffled = seededShuffle(samples, 1337);
    const split = Math.max(1, Math.floor(shuffled.length * 0.8));
    const train = shuffled.slice(0, split);
    const test = shuffled.slice(split);

    const trainXsRaw = train.map((s) => s.x);
    const trainYs = train.map((s) => s.y);
    const testXsRaw = test.map((s) => s.x);
    const testYs = test.map((s) => s.y);

    const { means, stds } = computeMeansStds(trainXsRaw);
    // Forest trains on raw values; still compute means/stds for consistency.
    const forest = trainRandomForest(trainXsRaw, trainYs, 2026);
    const trainAccuracy = computeForestAccuracy(forest, trainXsRaw, trainYs);
    const accuracy = testXsRaw.length ? computeForestAccuracy(forest, testXsRaw, testYs) : trainAccuracy;

    const testProbs = testXsRaw.map((x) => predictForestProb(forest, x));
    const holdoutAuc = testXsRaw.length ? computeRocAuc(testProbs, testYs) : 0.5;
    const confusionMatrix = computeConfusion(testProbs, testYs, 0.5);
    const featureImportance = testXsRaw.length ? permutationImportanceAuc(forest, testXsRaw, testYs, holdoutAuc) : [];

    cached = {
      algorithm: "random_forest",
      means,
      stds,
      forest,
      trainAccuracy,
      accuracy,
      holdoutAuc,
      confusionMatrix,
      featureImportance,
      trainedAt: new Date(),
      sampleCount: samples.length,
    };
    return cached;
  })();

  try {
    return await trainingPromise;
  } finally {
    trainingPromise = null;
  }
}

export async function predictPlacementProbability(features: PlacementFeatures): Promise<{ probability: number; modelAccuracy: number; sampleCount: number }> {
  const model = await getPlacementModel();
  const xRaw = featuresToArray({
    ...features,
    cgpa: clamp(features.cgpa, 0, 10),
    aptitudeTestScore: clamp(features.aptitudeTestScore, 0, 100),
    softSkillsRating: clamp(features.softSkillsRating, 1, 5),
    sscMarks: clamp(features.sscMarks, 0, 100),
    hscMarks: clamp(features.hscMarks, 0, 100),
    internships: clamp(features.internships, 0, 5),
    projects: clamp(features.projects, 0, 20),
    workshopsCertifications: clamp(features.workshopsCertifications, 0, 20),
  });

  const probability = predictForestProb(model.forest, xRaw);
  return { probability, modelAccuracy: model.accuracy, sampleCount: model.sampleCount };
}
