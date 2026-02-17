import mongoose, { Schema } from "mongoose";

export type ExamType = "aptitude" | "dsa" | "soft_skills" | "career";

export interface ExamAnswer {
  questionId: string;
  selectedOption: string;
  correctOption: string;
  isCorrect: boolean;
}

export interface ExamAttemptDoc {
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  examType: ExamType;
  createdAt: Date;
  updatedAt: Date;

  totalQuestions: number;
  score: number;
  percentage: number;
  grade: string;
  durationSeconds?: number;

  answers: ExamAnswer[];
}

const answerSchema = new Schema<ExamAnswer>(
  {
    questionId: { type: String, required: true },
    selectedOption: { type: String, required: true },
    correctOption: { type: String, required: true },
    isCorrect: { type: Boolean, required: true },
  },
  { _id: false }
);

const examAttemptSchema = new Schema<ExamAttemptDoc>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    examType: { type: String, required: true, enum: ["aptitude", "dsa", "soft_skills", "career"], index: true },

    totalQuestions: { type: Number, required: true },
    score: { type: Number, required: true },
    percentage: { type: Number, required: true },
    grade: { type: String, required: true },
    durationSeconds: { type: Number },

    answers: { type: [answerSchema], required: true },
  },
  { timestamps: true }
);

examAttemptSchema.index({ userId: 1, examType: 1, createdAt: -1 });

export const ExamAttempt = mongoose.model<ExamAttemptDoc>("ExamAttempt", examAttemptSchema);
