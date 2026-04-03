/**
 * ═══════════════════════════════════════════════════════════════════
 *  ADVANCED RAG PIPELINE v2 — Multi-Query, Re-Ranking, Caching
 * ═══════════════════════════════════════════════════════════════════
 *
 *  Knowledge Base (PDF / uploaded docs)
 *       ↓
 *  Document Processing  (pdf-parse → raw text)
 *       ↓
 *  Chunking             (sliding-window, 500 chars, 100 overlap)
 *       ↓
 *  Embeddings           (Gemini embedding-001, 3072-dim)
 *       ↓
 *  Vector Database      (MongoDB ragchunks collection)
 *       ↓
 *  User Query
 *       ↓
 *  Guardrails           (injection detect, sanitize)
 *       ↓
 *  Multi-Query Gen      (LLM generates 3 query variations)
 *       ↓
 *  Query Embeddings     (embed all query variations)
 *       ↓
 *  Similarity Search    (cosine similarity, threshold filter)
 *       ↓
 *  Re-Ranking           (keyword overlap + semantic score)
 *       ↓
 *  Context Compression  (trim to top 3-5 most relevant)
 *       ↓
 *  Grounded Prompt      (context + citations + student facts)
 *       ↓
 *  LLM                  (Groq / Gemini with guardrails)
 *       ↓
 *  Output Validation    (hallucination check)
 *       ↓
 *  Final Answer + Sources
 *
 * ═══════════════════════════════════════════════════════════════════
 */

import fs from "fs";
import path from "path";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { RagChunk } from "../models/RagChunk";
import { chainChat } from "./aiChain";

// ── Config ────────────────────────────────────────────────────────
const CHUNK_SIZE = 500;
const CHUNK_OVERLAP = 100;
const EMBEDDING_MODEL = "gemini-embedding-001";
const EMBED_BATCH = 5;
const EMBED_DELAY_MS = 1500;
const SIMILARITY_THRESHOLD = 0.25;
const MAX_RERANKED_CHUNKS = 5;
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes
const MAX_CACHE_SIZE = 100;

// ── LRU Cache ─────────────────────────────────────────────────────

interface CacheEntry {
    results: RagSearchResult[];
    timestamp: number;
}

const ragCache = new Map<string, CacheEntry>();

function getCacheKey(query: string, topK: number, sources?: string[]): string {
    return `${query.toLowerCase().trim()}::${topK}::${(sources || []).sort().join(",")}`;
}

function getCachedResults(key: string): RagSearchResult[] | null {
    const entry = ragCache.get(key);
    if (!entry) return null;
    if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
        ragCache.delete(key);
        return null;
    }
    return entry.results;
}

function setCacheResults(key: string, results: RagSearchResult[]): void {
    // Evict oldest if cache is full
    if (ragCache.size >= MAX_CACHE_SIZE) {
        const oldestKey = ragCache.keys().next().value;
        if (oldestKey) ragCache.delete(oldestKey);
    }
    ragCache.set(key, { results, timestamp: Date.now() });
}

// ── Helpers ───────────────────────────────────────────────────────

function getGeminiKey(): string {
    const key =
        process.env.STUDY_GEMINI_API_KEY ||
        process.env.INTERVIEW_GEMINI_API_KEY ||
        process.env.GEMINI_API_KEY;
    if (!key) throw new Error("No Gemini API key found for embeddings");
    return key;
}

function sleep(ms: number) {
    return new Promise((r) => setTimeout(r, ms));
}

// ── 1. Document Processing ────────────────────────────────────────

export async function extractTextFromPdf(pdfPath: string): Promise<string> {
    const { PDFParse } = await import("pdf-parse");
    const buffer = fs.readFileSync(pdfPath);
    const parser = new PDFParse({ data: buffer });
    const result = await parser.getText();
    await parser.destroy();
    return result.text;
}

// ── 2. Chunking ───────────────────────────────────────────────────

export interface TextChunk {
    text: string;
    charStart: number;
    charEnd: number;
    chunkIndex: number;
}

export function chunkText(
    fullText: string,
    chunkSize = CHUNK_SIZE,
    overlap = CHUNK_OVERLAP
): TextChunk[] {
    const chunks: TextChunk[] = [];
    let start = 0;
    let idx = 0;

    while (start < fullText.length) {
        let end = Math.min(start + chunkSize, fullText.length);

        if (end < fullText.length) {
            const slice = fullText.slice(start, end);
            const lastPeriod = slice.lastIndexOf(".");
            const lastNewline = slice.lastIndexOf("\n");
            const breakAt = Math.max(lastPeriod, lastNewline);
            if (breakAt > chunkSize * 0.3) {
                end = start + breakAt + 1;
            }
        }

        const text = fullText.slice(start, end).trim();
        if (text.length > 20) {
            chunks.push({ text, charStart: start, charEnd: end, chunkIndex: idx++ });
        }

        start = end - overlap;
        if (start >= fullText.length) break;
    }

    return chunks;
}

// ── 3. Embeddings ─────────────────────────────────────────────────

export async function generateEmbedding(text: string): Promise<number[]> {
    const genAI = new GoogleGenerativeAI(getGeminiKey());
    const model = genAI.getGenerativeModel({ model: EMBEDDING_MODEL });
    const result = await model.embedContent(text);
    return result.embedding.values;
}

export async function generateEmbeddings(texts: string[]): Promise<number[][]> {
    const results: number[][] = [];

    for (let i = 0; i < texts.length; i += EMBED_BATCH) {
        const batch = texts.slice(i, i + EMBED_BATCH);
        const embeddings = await Promise.all(batch.map((t) => generateEmbedding(t)));
        results.push(...embeddings);

        if (i + EMBED_BATCH < texts.length) {
            await sleep(EMBED_DELAY_MS);
        }
    }

    return results;
}

// ── 4. Vector Database (MongoDB) ──────────────────────────────────

export async function storeChunks(
    source: string,
    chunks: TextChunk[],
    embeddings: number[][],
    tags?: string[]
): Promise<number> {
    await RagChunk.deleteMany({ source });

    const docs = chunks.map((c, i) => ({
        source,
        chunkIndex: c.chunkIndex,
        text: c.text,
        embedding: embeddings[i],
        metadata: {
            charStart: c.charStart,
            charEnd: c.charEnd,
        },
        tags: tags || [],
    }));

    const inserted = await RagChunk.insertMany(docs);
    return inserted.length;
}

// ── 5. Ingestion ──────────────────────────────────────────────────

const INGEST_BATCH = 10;

export async function ingestPdf(pdfPath: string, tags?: string[]): Promise<{
    source: string;
    totalChunks: number;
    textLength: number;
}> {
    const source = path.basename(pdfPath);
    console.log(`[RAG] Step 1: Document Processing — reading ${source}...`);
    const rawText = await extractTextFromPdf(pdfPath);
    console.log(`[RAG]    Extracted ${rawText.length} characters`);

    console.log(`[RAG] Step 2: Chunking (size=${CHUNK_SIZE}, overlap=${CHUNK_OVERLAP})...`);
    const chunks = chunkText(rawText);
    console.log(`[RAG]    Created ${chunks.length} chunks`);

    await RagChunk.deleteMany({ source });

    console.log(`[RAG] Step 3+4: Embedding + Storing in batches of ${INGEST_BATCH}...`);
    let stored = 0;

    for (let i = 0; i < chunks.length; i += INGEST_BATCH) {
        const batch = chunks.slice(i, i + INGEST_BATCH);
        const texts = batch.map((c) => c.text);
        const embeddings = await Promise.all(texts.map((t) => generateEmbedding(t)));

        const docs = batch.map((c, j) => ({
            source,
            chunkIndex: c.chunkIndex,
            text: c.text,
            embedding: embeddings[j],
            metadata: { charStart: c.charStart, charEnd: c.charEnd },
            tags: tags || [],
        }));

        await RagChunk.insertMany(docs);
        stored += docs.length;

        console.log(`[RAG]    Batch ${Math.floor(i / INGEST_BATCH) + 1}: embedded + stored chunks ${i + 1}-${i + batch.length} (${stored}/${chunks.length})`);

        if (i + INGEST_BATCH < chunks.length) {
            await sleep(EMBED_DELAY_MS);
        }
    }

    // Clear cache since knowledge base changed
    ragCache.clear();

    console.log(`[RAG] Ingestion complete! ${stored} chunks stored.`);
    return { source, totalChunks: stored, textLength: rawText.length };
}

// ── 6. Multi-Query Generation ─────────────────────────────────────

export async function generateQueryVariations(originalQuery: string): Promise<string[]> {
    try {
        const { text } = await chainChat(
            `Generate exactly 3 alternative phrasings of this search query for a placement preparation knowledge base. Return ONLY the 3 queries, one per line, no numbering or bullets.\n\nOriginal query: "${originalQuery}"`,
            {
                system: "You are a query expansion assistant. Output only the 3 rephrased queries, nothing else.",
                temperature: 0.4,
                maxTokens: 200,
            }
        );

        const variations = text
            .split("\n")
            .map((l) => l.trim())
            .filter((l) => l.length > 5 && l.length < 300)
            .slice(0, 3);

        return [originalQuery, ...variations];
    } catch (err) {
        console.warn("[RAG] Multi-query generation failed, using original:", err);
        return [originalQuery];
    }
}

// ── 7. Cosine Similarity ──────────────────────────────────────────

function cosineSimilarity(a: number[], b: number[]): number {
    let dot = 0, magA = 0, magB = 0;
    for (let i = 0; i < a.length; i++) {
        dot += a[i] * b[i];
        magA += a[i] * a[i];
        magB += b[i] * b[i];
    }
    const denom = Math.sqrt(magA) * Math.sqrt(magB);
    return denom === 0 ? 0 : dot / denom;
}

// ── 8. Re-Ranking ─────────────────────────────────────────────────

function tokenize(text: string): Set<string> {
    return new Set(
        text.toLowerCase()
            .replace(/[^a-z0-9\s]/g, " ")
            .split(/\s+/)
            .filter((t) => t.length >= 3)
    );
}

function keywordOverlap(query: string, chunkText: string): number {
    const qTokens = tokenize(query);
    const cTokens = tokenize(chunkText);
    if (qTokens.size === 0) return 0;
    let overlap = 0;
    for (const t of qTokens) {
        if (cTokens.has(t)) overlap++;
    }
    return overlap / qTokens.size;
}

function reRankChunks(
    chunks: RagSearchResult[],
    originalQuery: string,
    maxResults: number = MAX_RERANKED_CHUNKS
): RagSearchResult[] {
    // Combine semantic score (70%) + keyword overlap (30%)
    const scored = chunks.map((c) => {
        const kwScore = keywordOverlap(originalQuery, c.text);
        const combinedScore = c.score * 0.7 + kwScore * 0.3;
        return { ...c, score: Math.round(combinedScore * 1000) / 1000 };
    });

    return scored
        .sort((a, b) => b.score - a.score)
        .slice(0, maxResults);
}

// ── 9. Context Compression ────────────────────────────────────────

export function compressContext(chunks: RagSearchResult[], maxChars: number = 3000): RagSearchResult[] {
    const result: RagSearchResult[] = [];
    let totalChars = 0;

    for (const chunk of chunks) {
        if (totalChars + chunk.text.length > maxChars) {
            // Trim this chunk to fit
            const remaining = maxChars - totalChars;
            if (remaining > 100) {
                result.push({
                    ...chunk,
                    text: chunk.text.slice(0, remaining) + "...",
                });
            }
            break;
        }
        result.push(chunk);
        totalChars += chunk.text.length;
    }

    return result;
}

// ── 10. Enhanced Similarity Search ────────────────────────────────

export interface RagSearchResult {
    chunkIndex: number;
    text: string;
    score: number;
    source: string;
}

export async function similaritySearch(
    query: string,
    topK = 5,
    options?: {
        useMultiQuery?: boolean;
        sources?: string[];
        threshold?: number;
    }
): Promise<RagSearchResult[]> {
    const useMultiQuery = options?.useMultiQuery ?? false;
    const threshold = options?.threshold ?? SIMILARITY_THRESHOLD;
    const sourceFilter = options?.sources;

    // Check cache
    const cacheKey = getCacheKey(query, topK, sourceFilter);
    const cached = getCachedResults(cacheKey);
    if (cached) {
        console.log("[RAG] Cache hit for query");
        return cached;
    }

    // Generate query variations if multi-query enabled
    const queries = useMultiQuery
        ? await generateQueryVariations(query)
        : [query];

    // Embed all queries
    const queryEmbeddings = await Promise.all(queries.map((q) => generateEmbedding(q)));

    // Load chunks from DB (with optional source filter)
    const filter: Record<string, any> = {};
    if (sourceFilter && sourceFilter.length > 0) {
        filter.source = { $in: sourceFilter };
    }
    const allChunks = await RagChunk.find(filter).lean();

    if (!allChunks.length) {
        return [];
    }

    // Score each chunk against ALL query embeddings, take max score
    const chunkScoreMap = new Map<number, { chunk: any; maxScore: number }>();

    for (const chunk of allChunks) {
        let maxScore = 0;
        for (const qEmb of queryEmbeddings) {
            const score = cosineSimilarity(qEmb, chunk.embedding);
            if (score > maxScore) maxScore = score;
        }

        // Threshold filter
        if (maxScore < threshold) continue;

        const existing = chunkScoreMap.get(chunk.chunkIndex);
        if (!existing || maxScore > existing.maxScore) {
            chunkScoreMap.set(chunk.chunkIndex, { chunk, maxScore });
        }
    }

    // Convert to results
    const scored: RagSearchResult[] = Array.from(chunkScoreMap.values())
        .map(({ chunk, maxScore }) => ({
            chunkIndex: chunk.chunkIndex,
            text: chunk.text,
            score: Math.round(maxScore * 1000) / 1000,
            source: chunk.source,
        }))
        .sort((a, b) => b.score - a.score)
        .slice(0, topK * 2); // Get extra for re-ranking

    // Re-rank using combined semantic + keyword score
    const reranked = reRankChunks(scored, query, topK);

    // Compress context
    const compressed = compressContext(reranked);

    // Cache results
    setCacheResults(cacheKey, compressed);

    return compressed;
}

// ── 11. Context Builder with Citations ────────────────────────────

export function buildRagContext(results: RagSearchResult[]): string {
    if (!results.length) return "(No relevant information found in the knowledge base)";

    return results
        .map(
            (r, i) =>
                `[Source ${i + 1}] (relevance: ${(r.score * 100).toFixed(1)}%, document: ${r.source}, chunk #${r.chunkIndex})\n${r.text}`
        )
        .join("\n\n---\n\n");
}

// ── 12. RAG Status ────────────────────────────────────────────────

export async function getRagStatus(): Promise<{
    indexed: boolean;
    totalChunks: number;
    sources: string[];
    lastUpdated: Date | null;
    cacheSize: number;
}> {
    const totalChunks = await RagChunk.countDocuments();
    const sources = await RagChunk.distinct("source");
    const latest = await RagChunk.findOne().sort({ updatedAt: -1 }).lean();

    return {
        indexed: totalChunks > 0,
        totalChunks,
        sources,
        lastUpdated: latest?.updatedAt ?? null,
        cacheSize: ragCache.size,
    };
}

// ── 13. Clear Cache ───────────────────────────────────────────────

export function clearRagCache(): number {
    const size = ragCache.size;
    ragCache.clear();
    return size;
}
