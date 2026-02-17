import mongoose, { Schema } from "mongoose";

export interface InterviewAnswerAnalysis {
  topic: string;
  question: string;
  answer: string;
  score: number;
  feedback: string;
  quickTip: string;
}

export interface InterviewSessionDoc {
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  currentWeek: number;
  topics: string[];
  answers: InterviewAnswerAnalysis[];
  overallScore: number;
  communicationScore: number;
  dsaScore: number;
  technicalScore: number;
  durationSeconds: number;
  completedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const answerSchema = new Schema<InterviewAnswerAnalysis>(
  {
    topic: { type: String, required: true },
    question: { type: String, required: true },
    answer: { type: String, required: true },
    score: { type: Number, required: true, min: 0, max: 10 },
    feedback: { type: String, required: true },
    quickTip: { type: String, required: true },
  },
  { _id: false }
);

const interviewSessionSchema = new Schema<InterviewSessionDoc>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    currentWeek: { type: Number, required: true, min: 1 },
    topics: { type: [String], required: true, default: [] },
    answers: { type: [answerSchema], required: true, default: [] },
    overallScore: { type: Number, required: true, min: 0, max: 10 },
    communicationScore: { type: Number, required: true, min: 0, max: 10 },
    dsaScore: { type: Number, required: true, min: 0, max: 10 },
    technicalScore: { type: Number, required: true, min: 0, max: 10 },
    durationSeconds: { type: Number, required: true, min: 0, default: 0 },
    completedAt: { type: Date, required: true, default: () => new Date() },
  },
  { timestamps: true }
);

interviewSessionSchema.index({ userId: 1, completedAt: -1 });

export const InterviewSession = mongoose.model<InterviewSessionDoc>("InterviewSession", interviewSessionSchema);
