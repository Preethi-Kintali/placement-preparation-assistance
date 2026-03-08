const { trainAndSaveModel } = require("../services/mlModelService");

async function run() {
  try {
    const model = await trainAndSaveModel();
    console.log("Model trained successfully.");
    console.log(`Vocabulary size: ${model.vocabulary.length}`);
    console.log(`Resume docs: ${model.stats.resumeCount}`);
    console.log(`JD docs: ${model.stats.jdCount}`);
    process.exit(0);
  } catch (error) {
    console.error("Model training failed:", error.message);
    process.exit(1);
  }
}

run();
