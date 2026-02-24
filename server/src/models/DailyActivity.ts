import mongoose, { Schema } from "mongoose";

export type ActivityType =
  | "daily_learning"
  | "new_tech_learned"
  | "roadmap_day_complete"
  | "weekly_test_completed"
  | "grand_test_completed"
  | "exam_completed"
  | "interview_completed";

export interface DailyActivityDoc {
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  // YYYY-MM-DD in UTC
  dateKey: string;
  count: number;
  byType: Record<ActivityType, number>;
  createdAt: Date;
  updatedAt: Date;
}

const dailyActivitySchema = new Schema<DailyActivityDoc>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    dateKey: { type: String, required: true, trim: true, index: true },
    count: { type: Number, required: true, default: 0, min: 0 },
    byType: {
      type: Object,
      default: () => ({
        daily_learning: 0,
        new_tech_learned: 0,
        roadmap_day_complete: 0,
        weekly_test_completed: 0,
        grand_test_completed: 0,
        exam_completed: 0,
        interview_completed: 0,
      }),
    },
  },
  { timestamps: true }
);

dailyActivitySchema.index({ userId: 1, dateKey: 1 }, { unique: true });

export const DailyActivity = mongoose.model<DailyActivityDoc>("DailyActivity", dailyActivitySchema);
