import Groq from "groq-sdk";
import { GoogleGenerativeAI } from "@google/generative-ai";

type ProviderName = "groq" | "gemini";

export type StudyChatTurn = { role: "user" | "assistant"; content: string };

function getKeys() {
  return {
    groqKey: process.env.STUDY_GROQ_API_KEY || process.env.INTERVIEW_GROQ_API_KEY,
    geminiKey: process.env.STUDY_GEMINI_API_KEY || process.env.INTERVIEW_GEMINI_API_KEY,
  };
}

function assertKeys(keys: { groqKey?: string; geminiKey?: string }) {
  if (!keys.groqKey && !keys.geminiKey) {
    throw new Error(
      "Study Assistant keys missing: set STUDY_GROQ_API_KEY/STUDY_GEMINI_API_KEY (preferred) or INTERVIEW_GROQ_API_KEY/INTERVIEW_GEMINI_API_KEY in server env"
    );
  }
}

export async function studyChatCompletion(input: {
  provider: ProviderName;
  system: string;
  messages: StudyChatTurn[];
  temperature?: number;
}): Promise<string> {
  const keys = getKeys();
  assertKeys(keys);

  if (input.provider === "groq") {
    if (!keys.groqKey) throw new Error("Groq key not set for Study Assistant");
    const groq = new Groq({ apiKey: keys.groqKey });

    const primaryModel = process.env.STUDY_GROQ_MODEL || "llama-3.1-8b-instant";
    const fallbackModel = "llama-3.1-8b-instant";

    const request = async (model: string) =>
      groq.chat.completions.create({
        model,
        temperature: input.temperature ?? 0.2,
        messages: [
          { role: "system", content: input.system },
          ...input.messages.map((m) => ({ role: m.role, content: m.content })),
        ],
      });

    let resp;
    try {
      resp = await request(primaryModel);
    } catch (e: any) {
      const msg = String(e?.error?.error?.code || e?.message || "");
      if (primaryModel !== fallbackModel && msg.includes("model_decommissioned")) {
        resp = await request(fallbackModel);
      } else {
        throw e;
      }
    }

    return resp.choices?.[0]?.message?.content?.trim() || "";
  }

  if (!keys.geminiKey) throw new Error("Gemini key not set for Study Assistant");
  const genAI = new GoogleGenerativeAI(keys.geminiKey);
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

  const parts: string[] = [];
  parts.push(`System:\n${input.system}`);
  for (const m of input.messages) {
    parts.push(`${m.role.toUpperCase()}: ${m.content}`);
  }
  parts.push("ASSISTANT:");

  const result = await model.generateContent(parts.join("\n\n"));
  return result.response.text().trim();
}
