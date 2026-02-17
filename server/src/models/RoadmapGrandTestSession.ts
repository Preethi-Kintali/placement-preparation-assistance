import mongoose, { Schema } from "mongoose";

export type GrandTestQuestionSource = "career" | "dsa" | "aptitude" | "soft_skills";

export interface GrandTestSessionQuestion {
  questionId: string;
  correctOption: string;
  source: GrandTestQuestionSource;
}

export interface GrandTestAnswer {
  questionId: string;
  selectedOption: string;
  correctOption: string;
  isCorrect: boolean;
}

export interface RoadmapGrandTestSessionDoc {
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  careerPath: string;

  questions: GrandTestSessionQuestion[];

  durationSeconds?: number;
  answers?: GrandTestAnswer[];
  score?: number;
  totalQuestions?: number;
  percentage?: number;
  passed?: boolean;

  usedAt?: Date;
  expiresAt: Date;

  createdAt: Date;
  updatedAt: Date;
}

const questionSchema = new Schema<GrandTestSessionQuestion>(
  {
    questionId: { type: String, required: true },
    correctOption: { type: String, required: true },
    source: { type: String, required: true, enum: ["career", "dsa", "aptitude", "soft_skills"] },
  },
  { _id: false }
);

const answerSchema = new Schema<GrandTestAnswer>(
  {
    questionId: { type: String, required: true },
    selectedOption: { type: String, required: true },
    correctOption: { type: String, required: true },
    isCorrect: { type: Boolean, required: true },
  },
  { _id: false }
);

const schema = new Schema<RoadmapGrandTestSessionDoc>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    careerPath: { type: String, required: true },

    questions: { type: [questionSchema], required: true },

    durationSeconds: { type: Number },
    answers: { type: [answerSchema] },
    score: { type: Number },
    totalQuestions: { type: Number },
    percentage: { type: Number },
    passed: { type: Boolean },

    usedAt: { type: Date },
    expiresAt: { type: Date, required: true, index: true },
  },
  { timestamps: true }
);

schema.index({ userId: 1, createdAt: -1 });

export const RoadmapGrandTestSession = mongoose.model<RoadmapGrandTestSessionDoc>(
  "RoadmapGrandTestSession",
  schema
);
