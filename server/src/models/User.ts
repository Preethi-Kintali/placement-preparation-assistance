import mongoose, { Schema } from "mongoose";

export type UserRole = "student" | "admin";

export type BadgeId =
  | "streak_7"
  | "streak_30"
  | "streak_120"
  | "first_exam"
  | "score_90"
  | "full_roadmap"
  | "interview_5";

export interface UnlockedBadge {
  id: BadgeId;
  unlockedAt: Date;
}

export interface GamificationProfile {
  healthPoints: number;
  currentStreak: number;
  longestStreak: number;
  // YYYY-MM-DD in UTC
  lastCheckInDate?: string;
  badges: UnlockedBadge[];
}

export interface StudentProfile {
  avatarUrl?: string;
  fullName: string;
  email: string;
  phone: string;
  bio?: string;

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
  gamification: GamificationProfile;
  createdAt: Date;
  updatedAt: Date;
}

const unlockedBadgeSchema = new Schema<UnlockedBadge>(
  {
    id: {
      type: String,
      enum: ["streak_7", "streak_30", "streak_120", "first_exam", "score_90", "full_roadmap", "interview_5"],
      required: true,
    },
    unlockedAt: { type: Date, required: true },
  },
  { _id: false }
);

const gamificationSchema = new Schema<GamificationProfile>(
  {
    healthPoints: { type: Number, default: 0, min: 0 },
    currentStreak: { type: Number, default: 0, min: 0 },
    longestStreak: { type: Number, default: 0, min: 0 },
    lastCheckInDate: { type: String, trim: true },
    badges: { type: [unlockedBadgeSchema], default: [] },
  },
  { _id: false }
);

const studentProfileSchema = new Schema<StudentProfile>(
  {
    avatarUrl: { type: String, trim: true },
    fullName: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true, lowercase: true },
    phone: { type: String, required: true, trim: true },
    bio: { type: String, trim: true, maxlength: 300 },

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
    gamification: { type: gamificationSchema, required: true, default: () => ({}) },
  },
  { timestamps: true }
);

userSchema.index({ "profile.email": 1 }, { unique: true });

export const User = mongoose.model<UserDoc>("User", userSchema);
