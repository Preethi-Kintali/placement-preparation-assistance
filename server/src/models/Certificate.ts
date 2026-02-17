import mongoose, { Schema } from "mongoose";

export interface CertificateDoc {
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  careerPath: string;
  certificateId: string;
  percentage: number;
  issuedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const certificateSchema = new Schema<CertificateDoc>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, unique: true, index: true },
    careerPath: { type: String, required: true },
    certificateId: { type: String, required: true, unique: true, index: true },
    percentage: { type: Number, required: true },
    issuedAt: { type: Date, required: true },
  },
  { timestamps: true }
);

export const Certificate = mongoose.model<CertificateDoc>("Certificate", certificateSchema);
