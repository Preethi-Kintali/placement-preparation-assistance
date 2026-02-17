import mongoose, { Schema } from "mongoose";

import type { RoadmapPlanWeek, RoadmapProvider } from "./RoadmapPlan";

export interface RoadmapTemplateDoc {
  _id: mongoose.Types.ObjectId;
  careerPath: string;
  provider: RoadmapProvider;
  generatedAt: Date;
  version: number;
  weeks: RoadmapPlanWeek[];
  createdAt: Date;
  updatedAt: Date;
}

const resourceSchema = new Schema<{ title: string; url: string }>(
  {
    title: { type: String, required: true },
    url: { type: String, required: true },
  },
  { _id: false }
);

const daySchema = new Schema<any>(
  {
    day: { type: Number, required: true },
    topic: { type: String, required: true },
    category: { type: String, required: true, enum: ["aptitude", "dsa", "softskills", "tech"] },
    difficulty: { type: String, required: true, enum: ["Beginner", "Intermediate", "Advanced"] },
    resources: { type: [resourceSchema], required: true, default: [] },
  },
  { _id: false }
);

const weekSchema = new Schema<any>(
  {
    week: { type: Number, required: true },
    title: { type: String, required: true },
    days: { type: [daySchema], required: true, default: [] },
  },
  { _id: false }
);

const roadmapTemplateSchema = new Schema<RoadmapTemplateDoc>(
  {
    careerPath: { type: String, required: true, index: true, unique: true },
    provider: { type: String, required: true, enum: ["groq", "gemini", "deterministic", "csv"] },
    generatedAt: { type: Date, required: true },
    version: { type: Number, required: true, default: 1 },
    weeks: { type: [weekSchema], required: true, default: [] },
  },
  { timestamps: true }
);

export const RoadmapTemplate = mongoose.model<RoadmapTemplateDoc>("RoadmapTemplate", roadmapTemplateSchema);
