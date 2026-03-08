import { z } from "zod";
import dotenv from "dotenv";

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(4000),

  MONGODB_URI: z.string().min(1),
  JWT_SECRET: z.string().min(16),

  // Allow local dev on either common Vite port.
  CLIENT_ORIGIN: z.string().default("http://localhost:5173,http://localhost:8080,http://localhost:8081"),

  // Optional integrations
  YOUTUBE_API_KEY: z.string().optional(),
  // Optional YouTube via RapidAPI (used when set; preferred over YOUTUBE_API_KEY)
  RAPIDAPI_KEY: z.string().optional(),
  RAPIDAPI_HOST: z.string().optional(),
  RAPIDAPI_URL: z.string().optional(),
  GROQ_API_KEY: z.string().optional(),
  GEMINI_API_KEY: z.string().optional(),
  INTERVIEW_GROQ_API_KEY: z.string().optional(),
  INTERVIEW_GEMINI_API_KEY: z.string().optional(),
  STUDY_GROQ_API_KEY: z.string().optional(),
  STUDY_GEMINI_API_KEY: z.string().optional(),
  STUDY_GROQ_MODEL: z.string().optional(),

  // Job Search (JSearch + Naukri via RapidAPI)
  JSEARCH_BASE_URL: z.string().optional(),
  JSEARCH_HOST: z.string().optional(),
  JSEARCH_SEARCH_PATH: z.string().optional(),
  JSEARCH_PAGES: z.coerce.number().int().positive().optional(),
  NAUKRI_BASE_URL: z.string().optional(),
  NAUKRI_HOST: z.string().optional(),
  NAUKRI_DISCOVERY_PATH: z.string().optional(),

  // Optional email notifications (Nodemailer)
  SMTP_ENABLED: z.coerce.boolean().optional().default(false),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_FROM: z.string().optional(),

  // Resume ATS Analyzer
  RESUME_GEMINI_API_KEY: z.string().optional(),

  // Additional fallback keys
  OPENROUTER_API_KEY: z.string().optional(),
  GROQ_API_KEY_2: z.string().optional(),
  GEMINI_API_KEY_2: z.string().optional(),
});

export type Env = z.infer<typeof envSchema>;

export const env: Env = envSchema.parse(process.env);

export const clientOrigins = env.CLIENT_ORIGIN.split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);
