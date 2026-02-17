import fs from "node:fs/promises";
import path from "node:path";
import { parse } from "csv-parse/sync";

function seededShuffle<T>(arr: T[], seed = 42): T[] {
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

function standardize(x: number[], means: number[], stds: number[]) {
  const out = new Array(x.length);
  for (let i = 0; i < x.length; i++) out[i] = (x[i] - means[i]) / (stds[i] || 1);
  return out;
}

function distSq(a: number[], b: number[]) {
  let s = 0;
  for (let i = 0; i < a.length; i++) {
    const d = a[i] - b[i];
    s += d * d;
  }
  return s;
}

function knnPredict(trainXs: number[][], trainYs: number[], x: number[], k: number) {
  const bestD = new Array(k).fill(Number.POSITIVE_INFINITY);
  const bestY = new Array(k).fill(0);
  let worstIdx = 0;
  let worstVal = bestD[0];

  const updateWorst = () => {
    worstIdx = 0;
    worstVal = bestD[0];
    for (let i = 1; i < k; i++) {
      if (bestD[i] > worstVal) {
        worstVal = bestD[i];
        worstIdx = i;
      }
    }
  };

  for (let i = 0; i < trainXs.length; i++) {
    const d = distSq(trainXs[i], x);
    if (d >= worstVal) continue;
    bestD[worstIdx] = d;
    bestY[worstIdx] = trainYs[i];
    updateWorst();
  }

  let votes = 0;
  for (let i = 0; i < k; i++) votes += bestY[i] ? 1 : -1;
  return votes >= 0 ? 1 : 0;
}

async function main() {
  const csvPath = path.resolve(process.cwd(), "..", "placementdata.csv");
  const raw = await fs.readFile(csvPath, "utf-8");
  const rows = parse(raw, { columns: true, skip_empty_lines: true, trim: true }) as any[];

  const samples = rows
    .map((r) => {
      const y = String(r.PlacementStatus || "").trim().toLowerCase() === "placed" ? 1 : 0;
      const extracurricular = String(r["ExtracurricularActivities"] || "").trim().toLowerCase() === "yes" ? 1 : 0;
      const training = String(r["PlacementTraining"] || "").trim().toLowerCase() === "yes" ? 1 : 0;

      const x = [
        Number(r.CGPA),
        Number(r.Internships),
        Number(r.Projects),
        Number(r["Workshops/Certifications"]),
        Number(r.AptitudeTestScore),
        Number(r.SoftSkillsRating),
        extracurricular,
        training,
        Number(r.SSC_Marks),
        Number(r.HSC_Marks),
      ].map((n) => (Number.isFinite(n) ? n : 0));

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
  const trainXs = trainXsRaw.map((x) => standardize(x, means, stds));
  const testXs = testXsRaw.map((x) => standardize(x, means, stds));

  const ks = [1, 3, 5, 7, 9, 11, 15, 21];
  const results: any[] = [];
  for (const k of ks) {
    let correct = 0;
    for (let i = 0; i < testXs.length; i++) {
      const pred = knnPredict(trainXs, trainYs, testXs[i], k);
      if (pred === testYs[i]) correct++;
    }
    results.push({ k, accuracyPct: Math.round((correct / testXs.length) * 10000) / 100 });
  }

  console.log(JSON.stringify({ algorithm: "knn", sampleCount: samples.length, results }, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
