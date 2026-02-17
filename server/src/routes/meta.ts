import { Router } from "express";
import { getCareerPathsFromDataset } from "../services/skillsDataset";
import { RoadmapTemplate } from "../models/RoadmapTemplate";

export const metaRouter = Router();

metaRouter.get("/career-paths", async (_req, res) => {
  const [datasetPaths, templatePaths] = await Promise.all([
    getCareerPathsFromDataset(),
    RoadmapTemplate.distinct("careerPath"),
  ]);

  const merged = Array.from(new Set([...(datasetPaths ?? []), ...(templatePaths ?? [])]))
    .map((s) => String(s ?? "").trim())
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b));

  return res.json({ careerPaths: merged });
});
