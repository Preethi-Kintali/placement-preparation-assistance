import { env } from "../config/env";
import { fetchJson } from "./http";
import { roadmapSchema } from "./groq";
import { z } from "zod";

const GEMINI_MODEL = "gemini-2.5-flash";

type GeminiResponse = {
  candidates?: Array<{
    content?: {
      parts?: Array<{ text?: string }>;
    };
  }>;
};

export async function geminiRoadmap(input: {
  careerPath: string;
  requirements: Record<string, unknown>;
  learnedTopics: string[];
}): Promise<z.infer<typeof roadmapSchema>> {
  if (!env.GEMINI_API_KEY) throw new Error("GEMINI_API_KEY not configured");

  const prompt =
    `You are generating a 12-week roadmap JSON for a ${input.careerPath} in 2026.\n` +
    `Use these role requirements JSON: ${JSON.stringify(input.requirements)}\n` +
    `The student already learned these topics (exclude them): ${JSON.stringify(input.learnedTopics)}\n\n` +
    `Return JSON ONLY with schema:\n` +
    `{ "careerPath": string, "weeks": [{ "week": 1..12, "title": string, "days": [` +
    `{ "day": 1..7, "topic": string, "category": "aptitude|dsa|softskills|tech", ` +
    `"difficulty": "Beginner|Intermediate|Advanced", "resources": [{"title": string, "url": string}] } ] }] }\n` +
    `Constraints:\n` +
    `- Exactly 12 weeks, each week exactly 7 days.\n` +
    `- Title MUST be exactly: "Week 1", "Week 2", ... "Week 12" (no fundamentals/intermediate/advanced labels).\n` +
    `- Tech-rich: at least 5 out of 7 days per week must have category "tech".\n` +
    `- Remaining days should include some "dsa" and some "aptitude"/"softskills" across the 12 weeks, but keep them lighter than tech.\n` +
    `- Keep difficulty ascending across weeks.\n` +
    `- Each day must include a GeeksforGeeks search link in resources for that topic.`;

  const url =
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${encodeURIComponent(env.GEMINI_API_KEY)}`;

  const data = await fetchJson<GeminiResponse>(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      contents: [
        {
          role: "user",
          parts: [{ text: prompt }],
        },
      ],
      generationConfig: { temperature: 0.2, maxOutputTokens: 1200 },
    }),
  });

  const raw = data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "{}";
  const parsed = JSON.parse(raw);
  return roadmapSchema.parse(parsed);
}
