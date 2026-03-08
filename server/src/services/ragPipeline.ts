/**
 * ═══════════════════════════════════════════════════════════════════
 *  RAG PIPELINE  –  Complete Retrieval-Augmented Generation flow
 * ═══════════════════════════════════════════════════════════════════
 *
 *  Knowledge Base (PDF)
 *       ↓
 *  Document Processing  (pdf-parse → raw text)
 *       ↓
 *  Chunking             (sliding-window, 500 chars, 100 overlap)
 *       ↓
 *  Embeddings           (Gemini text-embedding-004, 768-dim)
 *       ↓
 *  Vector Database      (MongoDB ragchunks collection)
 *       ↓
 *  User Query
 *       ↓
 *  Query Embedding      (same Gemini model)
 *       ↓
 *  Similarity Search    (cosine similarity, top-k)
 *       ↓
 *  Context + Prompt     (retrieved chunks + student facts)
 *       ↓
 *  LLM                  (Groq / Gemini chat)
 *       ↓
 *  Final Answer
 *
 * ═══════════════════════════════════════════════════════════════════
 */

import fs from "fs";
import path from "path";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { RagChunk } from "../models/RagChunk";

// ── Config ────────────────────────────────────────────────────────
const CHUNK_SIZE = 500;          // chars per chunk
const CHUNK_OVERLAP = 100;       // overlap between consecutive chunks
const EMBEDDING_MODEL = "gemini-embedding-001";
const EMBEDDING_DIM = 3072;
const EMBED_BATCH = 5;           // embed N texts per API call
const EMBED_DELAY_MS = 1500;     // delay between batches (rate-limit)

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
    // Dynamic import to avoid loading heavy pdf-parse module at server startup
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

        // Try to break at a sentence boundary
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
    embeddings: number[][]
): Promise<number> {
    // Clear old chunks for this source
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
    }));

    const inserted = await RagChunk.insertMany(docs);
    return inserted.length;
}

// ── 5. Ingestion (full pipeline: PDF → chunks → embeddings → DB) ─
//    Uses incremental batching to avoid OOM on large PDFs

const INGEST_BATCH = 10; // embed + store 10 chunks at a time

export async function ingestPdf(pdfPath: string): Promise<{
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

    // Clear old chunks for this source
    await RagChunk.deleteMany({ source });

    console.log(`[RAG] Step 3+4: Embedding + Storing in batches of ${INGEST_BATCH}...`);
    let stored = 0;

    for (let i = 0; i < chunks.length; i += INGEST_BATCH) {
        const batch = chunks.slice(i, i + INGEST_BATCH);
        const texts = batch.map((c) => c.text);

        // Embed this batch
        const embeddings = await Promise.all(texts.map((t) => generateEmbedding(t)));

        // Store this batch immediately
        const docs = batch.map((c, j) => ({
            source,
            chunkIndex: c.chunkIndex,
            text: c.text,
            embedding: embeddings[j],
            metadata: { charStart: c.charStart, charEnd: c.charEnd },
        }));

        await RagChunk.insertMany(docs);
        stored += docs.length;

        console.log(`[RAG]    Batch ${Math.floor(i / INGEST_BATCH) + 1}: embedded + stored chunks ${i + 1}-${i + batch.length} (${stored}/${chunks.length})`);

        // Rate-limit delay between batches
        if (i + INGEST_BATCH < chunks.length) {
            await sleep(EMBED_DELAY_MS);
        }
    }

    console.log(`[RAG] Ingestion complete! ${stored} chunks stored.`);
    return { source, totalChunks: stored, textLength: rawText.length };
}

// ── 6. Query Embedding ────────────────────────────────────────────
//    (reuses generateEmbedding above)

// ── 7. Similarity Search (cosine similarity) ──────────────────────

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

export interface RagSearchResult {
    chunkIndex: number;
    text: string;
    score: number;
    source: string;
}

export async function similaritySearch(
    query: string,
    topK = 5
): Promise<RagSearchResult[]> {
    // Step 6: Query Embedding
    const queryEmbedding = await generateEmbedding(query);

    // Load all chunks from DB
    const allChunks = await RagChunk.find({}).lean();

    if (!allChunks.length) {
        return [];
    }

    // Step 7: Cosine Similarity Search
    const scored = allChunks
        .map((chunk) => ({
            chunkIndex: chunk.chunkIndex,
            text: chunk.text,
            score: cosineSimilarity(queryEmbedding, chunk.embedding),
            source: chunk.source,
        }))
        .sort((a, b) => b.score - a.score)
        .slice(0, topK);

    return scored;
}

// ── 8. Context + Prompt Builder ───────────────────────────────────

export function buildRagContext(results: RagSearchResult[]): string {
    if (!results.length) return "(No RAG context available — knowledge base not indexed)";

    return results
        .map(
            (r, i) =>
                `[Source ${i + 1}] (score: ${r.score.toFixed(3)}, chunk #${r.chunkIndex})\n${r.text}`
        )
        .join("\n\n---\n\n");
}

// ── 9. RAG Status ─────────────────────────────────────────────────

export async function getRagStatus(): Promise<{
    indexed: boolean;
    totalChunks: number;
    sources: string[];
    lastUpdated: Date | null;
}> {
    const totalChunks = await RagChunk.countDocuments();
    const sources = await RagChunk.distinct("source");
    const latest = await RagChunk.findOne().sort({ updatedAt: -1 }).lean();

    return {
        indexed: totalChunks > 0,
        totalChunks,
        sources,
        lastUpdated: latest?.updatedAt ?? null,
    };
}
