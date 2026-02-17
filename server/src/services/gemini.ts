import { env } from "../config/env";
import { fetchJson } from "./http";

type GeminiResponse = {
  candidates?: Array<{
    content?: {
      parts?: Array<{ text?: string }>;
    };
  }>;
};

export async function geminiChat(message: string): Promise<string> {
  if (!env.GEMINI_API_KEY) throw new Error("GEMINI_API_KEY not configured");

  const url =
    "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=" +
    encodeURIComponent(env.GEMINI_API_KEY);

  const data = await fetchJson<GeminiResponse>(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      contents: [
        {
          role: "user",
          parts: [
            {
              text:
                "You are PlacePrep AI. Provide a short, structured answer.\n\nUser question:\n" + message,
            },
          ],
        },
      ],
      generationConfig: {
        temperature: 0.3,
        maxOutputTokens: 512,
      },
    }),
  });

  const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
  return text;
}
