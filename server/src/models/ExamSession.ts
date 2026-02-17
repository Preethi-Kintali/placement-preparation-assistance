import mongoose, { Schema } from "mongoose";

export type ExamType = "aptitude" | "dsa" | "soft_skills" | "career";

export interface SessionQuestion {
  questionId: string;
  correctOption: string;
}

export interface ExamSessionDoc {
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  examType: ExamType;
  createdAt: Date;
  updatedAt: Date;

  questions: SessionQuestion[];
  usedAt?: Date;
  expiresAt: Date;
}

const sessionQuestionSchema = new Schema<SessionQuestion>(
  {
    questionId: { type: String, required: true },
    correctOption: { type: String, required: true },
  },
  { _id: false }
);

const examSessionSchema = new Schema<ExamSessionDoc>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    examType: { type: String, required: true, enum: ["aptitude", "dsa", "soft_skills", "career"], index: true },
    questions: { type: [sessionQuestionSchema], required: true },
    usedAt: { type: Date },
    expiresAt: { type: Date, required: true, index: true },
  },
  { timestamps: true }
);

examSessionSchema.index({ userId: 1, examType: 1, createdAt: -1 });

export const ExamSession = mongoose.model<ExamSessionDoc>("ExamSession", examSessionSchema);
