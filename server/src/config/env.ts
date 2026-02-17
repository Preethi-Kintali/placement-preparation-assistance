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
});

export type Env = z.infer<typeof envSchema>;

export const env: Env = envSchema.parse(process.env);

export const clientOrigins = env.CLIENT_ORIGIN.split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);
