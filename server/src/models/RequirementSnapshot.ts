import mongoose, { Schema } from "mongoose";

export interface RequirementSnapshotDoc {
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  careerPath: string;
  generatedAt: Date;
  requirements: Record<string, unknown>;
}

const requirementSnapshotSchema = new Schema<RequirementSnapshotDoc>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    careerPath: { type: String, required: true },
    generatedAt: { type: Date, required: true },
    requirements: { type: Schema.Types.Mixed, required: true },
  },
  { timestamps: false }
);

requirementSnapshotSchema.index({ userId: 1, generatedAt: -1 });

export const RequirementSnapshot = mongoose.model<RequirementSnapshotDoc>(
  "RequirementSnapshot",
  requirementSnapshotSchema
);
