import { chainChat, getAllGroqKeys, getAllGeminiKeys } from "./aiChain";

type ProviderName = "groq" | "gemini";

export type StudyChatTurn = { role: "user" | "assistant"; content: string };

/**
 * studyChatCompletion — Study Assistant AI with chain fallback.
 * Tries the requested provider first, then falls back through the chain.
 * Provider preference: groq → gemini → openrouter (or gemini → groq → openrouter).
 */
export async function studyChatCompletion(input: {
  provider: ProviderName;
  system: string;
  messages: StudyChatTurn[];
  temperature?: number;
}): Promise<string> {
  // Build the full prompt from conversation history
  const parts: string[] = [];
  for (const m of input.messages) {
    parts.push(`${m.role.toUpperCase()}: ${m.content}`);
  }
  const lastMessage = parts.join("\n\n");

  const { text } = await chainChat(lastMessage, {
    system: input.system,
    temperature: input.temperature ?? 0.2,
    groqModel: process.env.STUDY_GROQ_MODEL || "llama-3.1-8b-instant",
    geminiModel: "gemini-2.0-flash",
  });

  return text;
}
