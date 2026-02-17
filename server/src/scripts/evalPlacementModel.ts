import { getPlacementModel } from "../services/placementModel";

async function main() {
  const model = await getPlacementModel();
  // accuracy is already computed on deterministic 80/20 split inside training
  console.log(JSON.stringify({
    algorithm: model.algorithm,
    holdoutAccuracyPct: Math.round(model.accuracy * 10000) / 100,
    trainAccuracyPct: Math.round((model.trainAccuracy ?? 0) * 10000) / 100,
    sampleCount: model.sampleCount,
    trainedAt: model.trainedAt,
  }, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
