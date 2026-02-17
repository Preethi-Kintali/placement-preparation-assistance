import mongoose, { Schema } from "mongoose";

export type WeeklyTestQuestionSource = "career" | "dsa" | "aptitude" | "soft_skills";

export interface WeeklyTestSessionQuestion {
  questionId: string;
  correctOption: string;
  source: WeeklyTestQuestionSource;
}

export interface WeeklyTestAnswer {
  questionId: string;
  selectedOption: string;
  correctOption: string;
  isCorrect: boolean;
}

export interface RoadmapWeeklyTestSessionDoc {
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  careerPath: string;
  week: number;

  questions: WeeklyTestSessionQuestion[];

  durationSeconds?: number;
  answers?: WeeklyTestAnswer[];
  score?: number;
  totalQuestions?: number;
  percentage?: number;
  passed?: boolean;

  usedAt?: Date;
  expiresAt: Date;

  createdAt: Date;
  updatedAt: Date;
}

const sessionQuestionSchema = new Schema<WeeklyTestSessionQuestion>(
  {
    questionId: { type: String, required: true },
    correctOption: { type: String, required: true },
    source: { type: String, required: true, enum: ["career", "dsa", "aptitude", "soft_skills"] },
  },
  { _id: false }
);

const answerSchema = new Schema<WeeklyTestAnswer>(
  {
    questionId: { type: String, required: true },
    selectedOption: { type: String, required: true },
    correctOption: { type: String, required: true },
    isCorrect: { type: Boolean, required: true },
  },
  { _id: false }
);

const roadmapWeeklyTestSessionSchema = new Schema<RoadmapWeeklyTestSessionDoc>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    careerPath: { type: String, required: true },
    week: { type: Number, required: true, index: true },

    questions: { type: [sessionQuestionSchema], required: true },

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

roadmapWeeklyTestSessionSchema.index({ userId: 1, week: 1, createdAt: -1 });

export const RoadmapWeeklyTestSession = mongoose.model<RoadmapWeeklyTestSessionDoc>(
  "RoadmapWeeklyTestSession",
  roadmapWeeklyTestSessionSchema
);
