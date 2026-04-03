import mongoose, { Schema } from "mongoose";

export interface StudyCitation {
  id: string;
  title: string;
}

export interface StudySessionDoc {
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  threadId?: string;
  provider: "groq" | "gemini";
  prompt: string;
  answer: string;
  citations: StudyCitation[];
  createdAt: Date;
  updatedAt: Date;
}

const citationSchema = new Schema<StudyCitation>(
  {
    id: { type: String, required: true },
    title: { type: String, required: true },
  },
  { _id: false }
);

const studySessionSchema = new Schema<StudySessionDoc>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    threadId: { type: String, index: true },
    provider: { type: String, required: true, enum: ["groq", "gemini"] },
    prompt: { type: String, required: true },
    answer: { type: String, required: true },
    citations: { type: [citationSchema], required: true, default: [] },
  },
  { timestamps: true }
);

studySessionSchema.index({ userId: 1, createdAt: -1 });

export const StudySession = mongoose.model<StudySessionDoc>("StudySession", studySessionSchema);
