import mongoose, { Schema } from "mongoose";
import type { ActivityType } from "./DailyActivity";

export interface ActivityEventDoc {
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  // YYYY-MM-DD in UTC
  dateKey: string;
  type: ActivityType;
  title: string;
  meta?: Record<string, unknown>;
  createdAt: Date;
}

const activityEventSchema = new Schema<ActivityEventDoc>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    dateKey: { type: String, required: true, trim: true, index: true },
    type: {
      type: String,
      enum: [
        "daily_learning",
        "new_tech_learned",
        "roadmap_day_complete",
        "weekly_test_completed",
        "grand_test_completed",
        "exam_completed",
        "interview_completed",
      ],
      required: true,
      index: true,
    },
    title: { type: String, required: true, trim: true },
    meta: { type: Object },
    createdAt: { type: Date, required: true, default: () => new Date(), index: true },
  },
  { versionKey: false }
);

activityEventSchema.index({ userId: 1, createdAt: -1 });

export const ActivityEvent = mongoose.model<ActivityEventDoc>("ActivityEvent", activityEventSchema);
