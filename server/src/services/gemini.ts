import { chainChat } from "./aiChain";

/**
 * geminiChat — AI chat powered by chain fallback.
 * Tries Gemini keys → Groq keys → OpenRouter automatically.
 */
export async function geminiChat(message: string): Promise<string> {
  const { text } = await chainChat(message, {
    system:
      "You are PlacePrep AI. Provide a short, structured answer.",
    geminiModel: "gemini-2.0-flash",
    temperature: 0.3,
    maxTokens: 512,
  });
  return text;
}
