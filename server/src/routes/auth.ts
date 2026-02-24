import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { z } from "zod";

import { env } from "../config/env";
import { User } from "../models/User";
import mongoose from "mongoose";
import { requireAuth } from "../middleware/auth";

export const authRouter = Router();

const signupSchema = z.object({
  role: z.enum(["student", "admin"]).default("student"),
  password: z.string().min(8),

  // Data URL (base64) avatar support. Keep bounded to avoid huge documents.
  avatarUrl: z.string().max(2_000_000).optional(),

  fullName: z.string().min(2),
  email: z.string().email(),
  phone: z.string().regex(/^[0-9]{10}$/, "Phone must be 10 digits"),

  bio: z.string().max(300).optional(),

  education: z
    .object({
      tenthPercent: z.number().min(0).max(100).optional(),
      twelfthPercent: z.number().min(0).max(100).optional(),
      btechCgpa: z.number().min(0).max(10).optional(),
      collegeName: z.string().min(2).optional(),
      branch: z.string().optional(),
      year: z.string().optional(),
    })
    .default({}),

  experience: z
    .object({
      projectCount: z.number().int().min(0).max(50).optional(),
      internshipsCount: z.number().int().min(0).max(20).optional(),
      workshopsCertificationsCount: z.number().int().min(0).max(50).optional(),
      technologies: z.array(z.string()).max(50).optional(),
      hasInternship: z.boolean().optional(),
      hasPatents: z.boolean().optional(),
    })
    .default({}),

  career: z
    .object({
      careerPath: z.string().optional(),
      targetCompany: z.string().optional(),
      targetLpa: z.number().min(0).max(200).optional(),
      dailyStudyHours: z.number().min(0).max(24).optional(),

      aptitudeLevel: z.enum(["Beginner", "Intermediate", "Advanced"]).optional(),
      dsaLevel: z.enum(["Beginner", "Intermediate", "Advanced"]).optional(),
      softSkillsLevel: z.enum(["Beginner", "Intermediate", "Advanced"]).optional(),
    })
    .default({}),
});

const loginSchema = z.object({
  // Accept either an email or a simple username like "admin"
  email: z.string().min(1),
  password: z.string().min(1),
});

function signToken(userId: string, role: "student" | "admin") {
  return jwt.sign({ userId, role }, env.JWT_SECRET, { expiresIn: "7d" });
}

function makeStudentId() {
  const now = new Date();
  const y = now.getFullYear().toString().slice(-2);
  const rand = Math.floor(100000 + Math.random() * 900000);
  return `STU${y}${rand}`;
}

async function supportsTransactions(): Promise<boolean> {
  try {
    const admin = mongoose.connection.db?.admin();
    if (!admin) return false;
    const res = await admin.command({ hello: 1 });
    return Boolean(res.setName);
  } catch {
    return false;
  }
}

authRouter.post("/signup", async (req, res) => {
  const parsed = signupSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const data = parsed.data;
  const passwordHash = await bcrypt.hash(data.password, 12);

  const studentId = makeStudentId();
  const payload = {
    studentId,
    role: data.role,
    passwordHash,
    profile: {
      avatarUrl: data.avatarUrl,
      fullName: data.fullName,
      email: data.email,
      phone: data.phone,
      bio: data.bio,
      education: data.education,
      experience: data.experience,
      career: data.career,
    },
  };

  const useTransactions = await supportsTransactions();

  if (useTransactions) {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const user = await User.create([payload], { session });
      await session.commitTransaction();

      const created = user[0];
      const token = signToken(String(created._id), created.role);
      return res.status(201).json({
        token,
        user: {
          id: String(created._id),
          studentId: created.studentId,
          role: created.role,
          profile: created.profile,
          gamification: created.gamification,
        },
      });
    } catch (e: any) {
      await session.abortTransaction();
      if (e?.code === 11000) {
        return res.status(409).json({ error: "Email already registered" });
      }
      throw e;
    } finally {
      session.endSession();
    }
  }

  try {
    const created = await User.create(payload);
    const token = signToken(String(created._id), created.role);
    return res.status(201).json({
      token,
      user: {
        id: String(created._id),
        studentId: created.studentId,
        role: created.role,
        profile: created.profile,
        gamification: created.gamification,
      },
    });
  } catch (e: any) {
    if (e?.code === 11000) {
      return res.status(409).json({ error: "Email already registered" });
    }
    throw e;
  }
});

authRouter.post("/login", async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const { email, password } = parsed.data;
  const identifier = String(email ?? "").trim().toLowerCase();

  // Special bootstrapped admin login: username=admin password=admin
  // Maps to a real DB user (role=admin) so the rest of the app works normally.
  if (identifier === "admin" && password === "admin") {
    const adminEmail = "admin@local";
    let adminUser = await User.findOne({ "profile.email": adminEmail, role: "admin" });
    if (!adminUser) {
      const passwordHash = await bcrypt.hash("admin", 12);
      adminUser = await User.create({
        studentId: makeStudentId(),
        role: "admin",
        passwordHash,
        profile: {
          fullName: "Admin",
          email: adminEmail,
          phone: "0000000000",
          education: {},
          experience: {},
          career: {},
        },
      });
    }
    const token = signToken(String(adminUser._id), adminUser.role);
    return res.json({
      token,
      user: {
        id: String(adminUser._id),
        studentId: adminUser.studentId,
        role: adminUser.role,
        profile: adminUser.profile,
        gamification: adminUser.gamification,
      },
    });
  }

  // Normal email login
  const user = await User.findOne({ "profile.email": identifier });
  if (!user) return res.status(401).json({ error: "Invalid credentials" });

  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) return res.status(401).json({ error: "Invalid credentials" });

  const token = signToken(String(user._id), user.role);
  return res.json({
    token,
    user: { id: String(user._id), studentId: user.studentId, role: user.role, profile: user.profile, gamification: user.gamification },
  });
});

authRouter.get("/me", requireAuth, async (req, res) => {
  const user = await User.findById(req.user!.userId);
  if (!user) return res.status(404).json({ error: "User not found" });
  return res.json({
    id: String(user._id),
    studentId: user.studentId,
    role: user.role,
    profile: user.profile,
    gamification: user.gamification,
  });
});

const updateProfileSchema = z
  .object({
    // Data URL (base64) avatar support. Keep bounded to avoid huge documents.
    avatarUrl: z.string().max(2_000_000).optional(),
    fullName: z.string().min(2).optional(),
    phone: z.string().regex(/^[0-9]{10}$/, "Phone must be 10 digits").optional(),

    bio: z.string().max(300).optional(),

    education: z
      .object({
        tenthPercent: z.number().min(0).max(100).optional(),
        twelfthPercent: z.number().min(0).max(100).optional(),
        btechCgpa: z.number().min(0).max(10).optional(),
        collegeName: z.string().min(2).max(200).optional(),
        branch: z.string().min(1).max(120).optional(),
        year: z.string().min(1).max(40).optional(),
      })
      .optional(),

    experience: z
      .object({
        projectCount: z.number().int().min(0).max(50).optional(),
        internshipsCount: z.number().int().min(0).max(20).optional(),
        workshopsCertificationsCount: z.number().int().min(0).max(50).optional(),
        technologies: z.array(z.string().min(1).max(80)).max(50).optional(),
        hasInternship: z.boolean().optional(),
        hasPatents: z.boolean().optional(),
      })
      .optional(),

    career: z
      .object({
        careerPath: z.string().min(2).max(120).optional(),
        targetCompany: z.string().min(2).max(120).optional(),
        targetLpa: z.number().min(0).max(200).optional(),
        dailyStudyHours: z.number().min(0).max(24).optional(),

        aptitudeLevel: z.enum(["Beginner", "Intermediate", "Advanced"]).optional(),
        dsaLevel: z.enum(["Beginner", "Intermediate", "Advanced"]).optional(),
        softSkillsLevel: z.enum(["Beginner", "Intermediate", "Advanced"]).optional(),
      })
      .optional(),
  })
  .strict();

authRouter.patch("/profile", requireAuth, async (req, res) => {
  const parsed = updateProfileSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const user = await User.findById(req.user!.userId);
  if (!user) return res.status(404).json({ error: "User not found" });

  const data = parsed.data;
  const profile: any = user.profile ?? {};

  if (typeof data.avatarUrl === "string") profile.avatarUrl = data.avatarUrl.trim();
  if (typeof data.fullName === "string") profile.fullName = data.fullName.trim();
  if (typeof data.phone === "string") profile.phone = data.phone.trim();
  if (typeof data.bio === "string") profile.bio = data.bio.trim();

  if (data.education) profile.education = { ...(profile.education ?? {}), ...data.education };
  if (data.career) profile.career = { ...(profile.career ?? {}), ...data.career };
  if (data.experience) {
    profile.experience = { ...(profile.experience ?? {}), ...data.experience };
    // keep backwards compatible boolean, but prefer numeric count.
    const internshipsCount = Number((profile.experience as any).internshipsCount ?? NaN);
    if (Number.isFinite(internshipsCount)) {
      (profile.experience as any).hasInternship = internshipsCount > 0;
    }
  }

  user.profile = profile;
  await user.save();

  return res.json({
    id: String(user._id),
    studentId: user.studentId,
    role: user.role,
    profile: user.profile,
    gamification: user.gamification,
  });
});
