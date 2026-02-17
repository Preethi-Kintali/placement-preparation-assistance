import mongoose, { Schema } from "mongoose";

export type UserRole = "student" | "admin";

export interface StudentProfile {
  avatarUrl?: string;
  fullName: string;
  email: string;
  phone: string;

  education: {
    tenthPercent?: number;
    twelfthPercent?: number;
    btechCgpa?: number;
    collegeName?: string;
    branch?: string;
    year?: string;
  };

  experience: {
    projectCount?: number;
    internshipsCount?: number;
    workshopsCertificationsCount?: number;
    technologies?: string[];
    hasInternship?: boolean;
    hasPatents?: boolean;
  };

  career: {
    careerPath?: string;
    targetCompany?: string;
    targetLpa?: number;
    dailyStudyHours?: number;

    aptitudeLevel?: "Beginner" | "Intermediate" | "Advanced";
    dsaLevel?: "Beginner" | "Intermediate" | "Advanced";
    softSkillsLevel?: "Beginner" | "Intermediate" | "Advanced";
  };
}

export interface UserDoc {
  _id: mongoose.Types.ObjectId;
  studentId: string;
  role: UserRole;
  passwordHash: string;
  profile: StudentProfile;
  createdAt: Date;
  updatedAt: Date;
}

const studentProfileSchema = new Schema<StudentProfile>(
  {
    avatarUrl: { type: String, trim: true },
    fullName: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true, lowercase: true },
    phone: { type: String, required: true, trim: true },

    education: {
      tenthPercent: Number,
      twelfthPercent: Number,
      btechCgpa: Number,
      collegeName: String,
      branch: String,
      year: String,
    },

    experience: {
      projectCount: Number,
      internshipsCount: Number,
      workshopsCertificationsCount: Number,
      technologies: [String],
      hasInternship: Boolean,
      hasPatents: Boolean,
    },

    career: {
      careerPath: String,
      targetCompany: String,
      targetLpa: Number,
      dailyStudyHours: Number,

      aptitudeLevel: { type: String, enum: ["Beginner", "Intermediate", "Advanced"] },
      dsaLevel: { type: String, enum: ["Beginner", "Intermediate", "Advanced"] },
      softSkillsLevel: { type: String, enum: ["Beginner", "Intermediate", "Advanced"] },
    },
  },
  { _id: false }
);

const userSchema = new Schema<UserDoc>(
  {
    studentId: { type: String, required: true, unique: true, index: true },
    role: { type: String, enum: ["student", "admin"], required: true, default: "student" },
    passwordHash: { type: String, required: true },
    profile: { type: studentProfileSchema, required: true },
  },
  { timestamps: true }
);

userSchema.index({ "profile.email": 1 }, { unique: true });

export const User = mongoose.model<UserDoc>("User", userSchema);
