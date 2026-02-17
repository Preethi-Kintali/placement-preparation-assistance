import mongoose, { Schema } from "mongoose";

export type RoadmapProvider = "groq" | "gemini" | "deterministic" | "csv";

export type RoadmapCategory = "aptitude" | "dsa" | "softskills" | "tech";

export interface RoadmapPlanDay {
  day: number;
  topic: string;
  category: RoadmapCategory;
  difficulty: "Beginner" | "Intermediate" | "Advanced";
  resources: { title: string; url: string }[];
}

export interface RoadmapPlanWeek {
  week: number;
  title: string;
  days: RoadmapPlanDay[];
}

export interface RoadmapPlanDoc {
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  careerPath: string;
  provider: RoadmapProvider;
  generatedAt: Date;
  requirements: Record<string, unknown>;
  learnedTopics: string[];
  weeks: RoadmapPlanWeek[];
}

const resourceSchema = new Schema<{ title: string; url: string }>(
  {
    title: { type: String, required: true },
    url: { type: String, required: true },
  },
  { _id: false }
);

const daySchema = new Schema<RoadmapPlanDay>(
  {
    day: { type: Number, required: true },
    topic: { type: String, required: true },
    category: { type: String, required: true, enum: ["aptitude", "dsa", "softskills", "tech"] },
    difficulty: { type: String, required: true, enum: ["Beginner", "Intermediate", "Advanced"] },
    resources: { type: [resourceSchema], required: true, default: [] },
  },
  { _id: false }
);

const weekSchema = new Schema<RoadmapPlanWeek>(
  {
    week: { type: Number, required: true },
    title: { type: String, required: true },
    days: { type: [daySchema], required: true, default: [] },
  },
  { _id: false }
);

const roadmapPlanSchema = new Schema<RoadmapPlanDoc>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true, unique: true },
    careerPath: { type: String, required: true },
    provider: { type: String, required: true, enum: ["groq", "gemini", "deterministic", "csv"] },
    generatedAt: { type: Date, required: true },
    requirements: { type: Schema.Types.Mixed, required: true },
    learnedTopics: { type: [String], required: true, default: [] },
    weeks: { type: [weekSchema], required: true, default: [] },
  },
  { timestamps: false }
);

export const RoadmapPlan = mongoose.model<RoadmapPlanDoc>("RoadmapPlan", roadmapPlanSchema);
