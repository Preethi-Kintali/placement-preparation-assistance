import mongoose, { Schema } from "mongoose";

export interface WeeklyTestResult {
  week: number;
  percentage: number;
  passed: boolean;
  takenAt: Date;
}

export interface RoadmapProgressDoc {
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  unlockedWeek: number;
  completedDays: string[]; // "week-day" e.g. "1-3"
  weeklyTests: WeeklyTestResult[];
  createdAt: Date;
  updatedAt: Date;
}

const weeklyTestSchema = new Schema<WeeklyTestResult>(
  {
    week: { type: Number, required: true },
    percentage: { type: Number, required: true },
    passed: { type: Boolean, required: true },
    takenAt: { type: Date, required: true },
  },
  { _id: false }
);

const roadmapProgressSchema = new Schema<RoadmapProgressDoc>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, unique: true, index: true },
    unlockedWeek: { type: Number, required: true, default: 1 },
    completedDays: { type: [String], required: true, default: [] },
    weeklyTests: { type: [weeklyTestSchema], required: true, default: [] },
  },
  { timestamps: true }
);

export const RoadmapProgress = mongoose.model<RoadmapProgressDoc>("RoadmapProgress", roadmapProgressSchema);
