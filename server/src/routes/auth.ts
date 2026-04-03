import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { z } from "zod";

import { env } from "../config/env";
import { User } from "../models/User";
import mongoose from "mongoose";
import { requireAuth } from "../middleware/auth";
import { sendEmail } from "../services/mailer";

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

let _txSupportCached: boolean | null = null;

async function supportsTransactions(): Promise<boolean> {
  if (_txSupportCached !== null) return _txSupportCached;
  try {
    const admin = mongoose.connection.db?.admin();
    if (!admin) { _txSupportCached = false; return false; }
    const res = await admin.command({ hello: 1 });
    _txSupportCached = Boolean(res.setName);
    return _txSupportCached;
  } catch {
    _txSupportCached = false;
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

// ═══════════════════════════════════════════════════════════════════════
//  FORGOT PASSWORD — OTP Flow
// ═══════════════════════════════════════════════════════════════════════

interface OtpEntry {
  otp: string;
  expiresAt: number;
  attempts: number;
}

const otpStore = new Map<string, OtpEntry>();

function generateOtp(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function cleanExpiredOtps() {
  const now = Date.now();
  for (const [key, entry] of otpStore) {
    if (now > entry.expiresAt) otpStore.delete(key);
  }
}

// Step 1: Request OTP
authRouter.post("/forgot-password", async (req, res) => {
  const parsed = z.object({ email: z.string().email() }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Please provide a valid email." });

  const email = parsed.data.email.trim().toLowerCase();
  const user = await User.findOne({ "profile.email": email });
  if (!user) {
    // Don't reveal whether an account exists — still return ok
    return res.json({ ok: true, message: "If an account with that email exists, an OTP has been sent." });
  }

  cleanExpiredOtps();
  const otp = generateOtp();
  const OTP_TTL_MS = 10 * 60 * 1000; // 10 minutes

  otpStore.set(email, {
    otp,
    expiresAt: Date.now() + OTP_TTL_MS,
    attempts: 0,
  });

  console.log(`[Auth] OTP for ${email}: ${otp}`);

  // Send via email (non-blocking — don't wait for email delivery)
  sendEmail({
    to: email,
    subject: "🔑 PlacePrep — Password Reset OTP",
    text: `Your OTP to reset your password is: ${otp}\n\nThis OTP expires in 10 minutes. If you did not request this, please ignore this email.`,
    html: `
      <div style="font-family:'Segoe UI',Arial,sans-serif;max-width:480px;margin:0 auto;">
        <div style="background:linear-gradient(135deg,#6c63ff,#9c5fff);padding:24px;border-radius:12px 12px 0 0;text-align:center;">
          <h1 style="color:#fff;margin:0;font-size:22px;">🔑 Password Reset</h1>
        </div>
        <div style="background:#fff;padding:24px;border:1px solid #eee;border-top:none;text-align:center;">
          <p style="color:#333;font-size:15px;margin-bottom:16px;">Your one-time password is:</p>
          <div style="font-size:36px;font-weight:900;letter-spacing:8px;color:#6c63ff;background:#f4f4ff;padding:16px;border-radius:12px;display:inline-block;">${otp}</div>
          <p style="color:#888;font-size:13px;margin-top:16px;">This OTP expires in <strong>10 minutes</strong>.</p>
        </div>
        <div style="padding:12px;text-align:center;background:#f9fafb;border-radius:0 0 12px 12px;border:1px solid #eee;border-top:none;">
          <p style="color:#aaa;font-size:11px;margin:0;">If you didn't request this, please ignore this email.</p>
        </div>
      </div>`,
  }).then((result) => {
    if (result.skipped) {
      console.log(`[Auth] SMTP not configured — OTP logged to console above`);
    }
  }).catch((e) => {
    console.error("[Auth] Email send failed:", e);
  });

  return res.json({ ok: true, message: "If an account with that email exists, an OTP has been sent." });
});

// Step 2: Verify OTP
authRouter.post("/verify-otp", async (req, res) => {
  const parsed = z.object({ email: z.string().email(), otp: z.string().length(6) }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Please provide email and 6-digit OTP." });

  const email = parsed.data.email.trim().toLowerCase();
  const entry = otpStore.get(email);

  if (!entry) return res.status(400).json({ error: "No OTP was requested for this email. Please request a new one." });
  if (Date.now() > entry.expiresAt) {
    otpStore.delete(email);
    return res.status(400).json({ error: "OTP has expired. Please request a new one." });
  }
  if (entry.attempts >= 5) {
    otpStore.delete(email);
    return res.status(429).json({ error: "Too many failed attempts. Please request a new OTP." });
  }

  if (entry.otp !== parsed.data.otp) {
    entry.attempts++;
    return res.status(400).json({ error: "Invalid OTP. Please try again." });
  }

  return res.json({ valid: true });
});

// Step 3: Reset Password
authRouter.post("/reset-password", async (req, res) => {
  const parsed = z.object({
    email: z.string().email(),
    otp: z.string().length(6),
    newPassword: z.string().min(8),
  }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const email = parsed.data.email.trim().toLowerCase();
  const entry = otpStore.get(email);

  if (!entry) return res.status(400).json({ error: "No OTP was requested for this email." });
  if (Date.now() > entry.expiresAt) {
    otpStore.delete(email);
    return res.status(400).json({ error: "OTP has expired. Please request a new one." });
  }
  if (entry.otp !== parsed.data.otp) {
    return res.status(400).json({ error: "Invalid OTP." });
  }

  const user = await User.findOne({ "profile.email": email });
  if (!user) return res.status(404).json({ error: "User not found." });

  user.passwordHash = await bcrypt.hash(parsed.data.newPassword, 12);
  await user.save();

  otpStore.delete(email);
  return res.json({ ok: true, message: "Password has been reset successfully. You can now login." });
});
