/**
 * aiChain.ts — Unified AI chain-fallback service.
 *
 * Tries providers in this order:
 *   Gemini keys → Groq keys → OpenRouter
 *
 * On rate-limit / quota / 429 / 503 errors → auto-skip to next provider.
 * Exports helpers so every service in the project can use the chain.
 */

import { GoogleGenerativeAI } from "@google/generative-ai";
import { fetchJson } from "./http";

// ── Collect all available keys ─────────────────────────────────

export function getAllGeminiKeys(): string[] {
    const keys: string[] = [];
    const add = (k?: string) => { if (k?.trim()) keys.push(k.trim()); };
    add(process.env.GEMINI_API_KEY);
    add(process.env.GEMINI_API_KEY_2);
    add(process.env.INTERVIEW_GEMINI_API_KEY);
    add(process.env.RESUME_GEMINI_API_KEY);
    add(process.env.STUDY_GEMINI_API_KEY);
    return [...new Set(keys)]; // deduplicate
}

export function getAllGroqKeys(): string[] {
    const keys: string[] = [];
    const add = (k?: string) => { if (k?.trim()) keys.push(k.trim()); };
    add(process.env.GROQ_API_KEY);
    add(process.env.GROQ_API_KEY_2);
    add(process.env.INTERVIEW_GROQ_API_KEY);
    add(process.env.STUDY_GROQ_API_KEY);
    return [...new Set(keys)];
}

export function getOpenRouterKey(): string | undefined {
    return process.env.OPENROUTER_API_KEY?.trim() || undefined;
}

// ── Error detection ────────────────────────────────────────────

function isRetryableError(err: any): boolean {
    const msg = String(err?.message || err?.error?.message || "").toLowerCase();
    return (
        msg.includes("429") ||
        msg.includes("quota") ||
        msg.includes("resource_exhausted") ||
        msg.includes("rate") ||
        msg.includes("503") ||
        msg.includes("overloaded") ||
        msg.includes("too many requests") ||
        msg.includes("capacity")
    );
}

// ── Provider call helpers ──────────────────────────────────────

async function callGemini(
    prompt: string,
    apiKey: string,
    options?: { model?: string; temperature?: number; maxTokens?: number },
): Promise<string> {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
        model: options?.model || "gemini-2.0-flash",
        generationConfig: {
            temperature: options?.temperature ?? 0.3,
            maxOutputTokens: options?.maxTokens ?? 2048,
        },
    });
    const result = await model.generateContent(prompt);
    return result.response.text().trim();
}

type GroqResponse = { choices: Array<{ message: { content: string } }> };

async function callGroq(
    system: string,
    message: string,
    apiKey: string,
    options?: { model?: string; temperature?: number },
): Promise<string> {
    const data = await fetchJson<GroqResponse>("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
            "content-type": "application/json",
            authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
            model: options?.model || "llama-3.3-70b-versatile",
            temperature: options?.temperature ?? 0.3,
            messages: [
                { role: "system", content: system },
                { role: "user", content: message },
            ],
        }),
    });
    return data.choices?.[0]?.message?.content?.trim() ?? "";
}

type OpenRouterResponse = { choices: Array<{ message: { content: string } }> };

async function callOpenRouter(
    system: string,
    message: string,
    apiKey: string,
    options?: { model?: string; temperature?: number },
): Promise<string> {
    const data = await fetchJson<OpenRouterResponse>("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
            "content-type": "application/json",
            authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
            model: options?.model || "meta-llama/llama-3.3-70b-instruct:free",
            temperature: options?.temperature ?? 0.3,
            messages: [
                { role: "system", content: system },
                { role: "user", content: message },
            ],
        }),
    });
    return data.choices?.[0]?.message?.content?.trim() ?? "";
}

// ── Main chain function ────────────────────────────────────────

export interface ChainOptions {
    system?: string;        // System prompt (for Groq/OpenRouter chat format)
    temperature?: number;
    maxTokens?: number;
    geminiModel?: string;
    groqModel?: string;
    openRouterModel?: string;
}

/**
 * chainChat — Send a message through the AI chain.
 * Tries Gemini keys → Groq keys → OpenRouter.
 * Returns { text, provider } on success.
 */
export async function chainChat(
    prompt: string,
    options: ChainOptions = {},
): Promise<{ text: string; provider: string }> {
    const system = options.system || "You are a helpful AI assistant. Be concise and actionable.";
    const errors: string[] = [];

    // 1. Try all Gemini keys
    for (const key of getAllGeminiKeys()) {
        try {
            const text = await callGemini(
                `${system}\n\nUser:\n${prompt}`,
                key,
                { model: options.geminiModel, temperature: options.temperature, maxTokens: options.maxTokens },
            );
            if (text) return { text, provider: `gemini(${key.slice(-6)})` };
        } catch (err: any) {
            const msg = err?.message?.slice(0, 100) || String(err);
            errors.push(`Gemini(${key.slice(-6)}): ${msg}`);
            if (!isRetryableError(err)) {
                console.warn(`[AIChain] Gemini non-retryable error, skipping key:`, msg);
            }
        }
    }

    // 2. Try all Groq keys
    for (const key of getAllGroqKeys()) {
        try {
            const text = await callGroq(
                system, prompt, key,
                { model: options.groqModel, temperature: options.temperature },
            );
            if (text) return { text, provider: `groq(${key.slice(-6)})` };
        } catch (err: any) {
            const msg = err?.message?.slice(0, 100) || String(err);
            errors.push(`Groq(${key.slice(-6)}): ${msg}`);
        }
    }

    // 3. Try OpenRouter
    const orKey = getOpenRouterKey();
    if (orKey) {
        try {
            const text = await callOpenRouter(
                system, prompt, orKey,
                { model: options.openRouterModel, temperature: options.temperature },
            );
            if (text) return { text, provider: "openrouter" };
        } catch (err: any) {
            const msg = err?.message?.slice(0, 100) || String(err);
            errors.push(`OpenRouter: ${msg}`);
        }
    }

    // All providers failed
    console.error("[AIChain] All providers failed:", errors.join(" | "));
    throw new Error(`All AI providers failed. Errors: ${errors.join("; ")}`);
}

/**
 * chainGenerate — Simple prompt completion (no system prompt).
 * Used by services that just need raw text generation.
 */
export async function chainGenerate(
    prompt: string,
    options: Omit<ChainOptions, "system"> = {},
): Promise<{ text: string; provider: string }> {
    return chainChat(prompt, { ...options, system: "" });
}
