import { env } from "../config/env";
import { fetchJson } from "./http";
import { z } from "zod";

type GroqChatResponse = {
  choices: Array<{ message: { role: string; content: string } }>;
};

export async function groqChat(message: string): Promise<string> {
  if (!env.GROQ_API_KEY) throw new Error("GROQ_API_KEY not configured");

  const data = await fetchJson<GroqChatResponse>("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${env.GROQ_API_KEY}`,
    },
    body: JSON.stringify({
      model: "llama-3.3-70b-versatile",
      temperature: 0.3,
      messages: [
        {
          role: "system",
          content:
            "You are PlacePrep AI. Help Indian engineering students with a practical placement roadmap: aptitude + DSA + soft skills + career-path tech. Be concise and actionable.",
        },
        { role: "user", content: message },
      ],
    }),
  });

  return data.choices?.[0]?.message?.content ?? "";
}

export async function groqRequirements(careerPath: string): Promise<Record<string, unknown>> {
  if (!env.GROQ_API_KEY) throw new Error("GROQ_API_KEY not configured");

  const prompt = `Generate a concise JSON of 2026 requirements for a ${careerPath}.\n\n` +
    `Return JSON ONLY with this schema:\n` +
    `{ "careerPath": string, "skills": { "technical": string[], "aptitude": string[], "dsa": string[], "softSkills": string[] } }`;

  const data = await fetchJson<GroqChatResponse>("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${env.GROQ_API_KEY}`,
    },
    body: JSON.stringify({
      model: "llama-3.3-70b-versatile",
      temperature: 0.2,
      messages: [
        { role: "system", content: "Return valid JSON only." },
        { role: "user", content: prompt },
      ],
    }),
  });

  const raw = data.choices?.[0]?.message?.content ?? "{}";
  try {
    return JSON.parse(raw);
  } catch {
    return { careerPath, skills: { technical: [], aptitude: [], dsa: [], softSkills: [] } };
  }
}

export const roadmapSchema = z.object({
  careerPath: z.string(),
  weeks: z.array(
    z.object({
      week: z.number().int().min(1).max(12),
      title: z.string(),
      days: z.array(
        z.object({
          day: z.number().int().min(1).max(7),
          topic: z.string(),
          category: z.string(),
          difficulty: z.string(),
          resources: z.array(z.object({ title: z.string(), url: z.string().url() })).default([]),
        })
      ),
    })
  ),
});

export async function groqRoadmap(input: {
  careerPath: string;
  requirements: Record<string, unknown>;
  learnedTopics: string[];
}): Promise<z.infer<typeof roadmapSchema>> {
  if (!env.GROQ_API_KEY) throw new Error("GROQ_API_KEY not configured");

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
    `- Remaining days should include some "dsa" and some "aptitude"/"softskills" across the 12 weeks (these are common), but keep them lighter than tech.\n` +
    `- Keep difficulty ascending across weeks.\n` +
    `- Each day must include a GeeksforGeeks search link in resources for that topic.`;

  const data = await fetchJson<GroqChatResponse>("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${env.GROQ_API_KEY}`,
    },
    body: JSON.stringify({
      model: "llama-3.3-70b-versatile",
      temperature: 0.2,
      messages: [
        { role: "system", content: "Return valid JSON only. No markdown." },
        { role: "user", content: prompt },
      ],
    }),
  });

  const raw = data.choices?.[0]?.message?.content ?? "{}";
  const parsed = JSON.parse(raw);
  return roadmapSchema.parse(parsed);
}
