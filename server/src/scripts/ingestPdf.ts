/**
 * RAG Ingestion Script — Lightweight version
 * Uses raw fetch for embeddings to avoid SDK memory overhead
 * 
 * Usage: npm run ingest
 */

import path from "path";
import fs from "fs";
import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();

// ── Minimal Mongoose Schema (inline to avoid importing heavy modules) ──
const ragChunkSchema = new mongoose.Schema(
    {
        source: { type: String, required: true, index: true },
        chunkIndex: { type: Number, required: true },
        text: { type: String, required: true },
        embedding: { type: [Number], required: true },
        metadata: {
            charStart: { type: Number, required: true },
            charEnd: { type: Number, required: true },
        },
    },
    { timestamps: true }
);
ragChunkSchema.index({ source: 1, chunkIndex: 1 }, { unique: true });
const RagChunk = mongoose.model("RagChunk", ragChunkSchema);

// ── Config ──
const CHUNK_SIZE = 500;
const CHUNK_OVERLAP = 100;
const DELAY_MS = 500;

function sleep(ms: number) {
    return new Promise((r) => setTimeout(r, ms));
}

// ── Chunking (pure logic, no imports) ──
function chunkText(fullText: string): Array<{ text: string; charStart: number; charEnd: number; chunkIndex: number }> {
    const chunks: Array<{ text: string; charStart: number; charEnd: number; chunkIndex: number }> = [];
    let start = 0;
    let idx = 0;

    while (start < fullText.length) {
        let end = Math.min(start + CHUNK_SIZE, fullText.length);

        if (end < fullText.length) {
            const slice = fullText.slice(start, end);
            const lastPeriod = slice.lastIndexOf(".");
            const lastNewline = slice.lastIndexOf("\n");
            const breakAt = Math.max(lastPeriod, lastNewline);
            if (breakAt > CHUNK_SIZE * 0.3) {
                end = start + breakAt + 1;
            }
        }

        const text = fullText.slice(start, end).trim();
        if (text.length > 20) {
            chunks.push({ text, charStart: start, charEnd: end, chunkIndex: idx++ });
        }

        start = end - CHUNK_OVERLAP;
        if (start >= fullText.length) break;
    }

    return chunks;
}

// ── Embedding via raw fetch (no SDK) ──
async function getEmbedding(text: string, apiKey: string): Promise<number[]> {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key=${apiKey}`;

    const resp = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            content: { parts: [{ text }] },
        }),
    });

    if (!resp.ok) {
        const err = await resp.text();
        throw new Error(`Embedding API error (${resp.status}): ${err}`);
    }

    const data = await resp.json();
    return data.embedding.values;
}

// ── Main ──
async function main() {
    console.log("=== RAG Knowledge Base Ingestion ===\n");

    const geminiKey =
        process.env.STUDY_GEMINI_API_KEY ||
        process.env.INTERVIEW_GEMINI_API_KEY ||
        process.env.GEMINI_API_KEY;

    if (!geminiKey) {
        console.error("[FAIL] No Gemini API key found");
        process.exit(1);
    }

    // Connect to MongoDB
    const mongoUri = process.env.MONGODB_URI || "";
    try {
        await mongoose.connect(mongoUri.includes("/placeprep") ? mongoUri : mongoUri.replace(/\/[^/?]*(\?|$)/, "/placeprep$1"));
        console.log(`[OK] MongoDB connected (db=${mongoose.connection.name})\n`);
    } catch (err) {
        console.error("[FAIL] MongoDB:", err);
        process.exit(1);
    }

    // Resolve paths
    const pdfPath = path.resolve(process.cwd(), "..", "Placement_Assistance_RAG_System.pdf");
    const txtPath = path.resolve(process.cwd(), "..", "Placement_Assistance_RAG_System.txt");

    if (!fs.existsSync(pdfPath) && !fs.existsSync(txtPath)) {
        console.error("[FAIL] Neither PDF nor cached text found");
        process.exit(1);
    }

    // ── Step 1: Get text ──
    let rawText: string;

    if (fs.existsSync(txtPath) && fs.statSync(txtPath).size > 100) {
        console.log("[RAG] Step 1: Using cached text file");
        rawText = fs.readFileSync(txtPath, "utf-8");
    } else {
        console.log("[RAG] Step 1: Extracting text from PDF...");
        const { PDFParse } = await import("pdf-parse");
        const buffer = fs.readFileSync(pdfPath);
        const parser = new PDFParse({ data: buffer });
        const result = await parser.getText();
        rawText = result.text;
        await parser.destroy();
        fs.writeFileSync(txtPath, rawText, "utf-8");
    }

    console.log(`[RAG]    ${rawText.length} characters\n`);

    // ── Step 2: Chunk ──
    console.log("[RAG] Step 2: Chunking...");
    const chunks = chunkText(rawText);
    console.log(`[RAG]    ${chunks.length} chunks\n`);

    // ── Step 3+4: Embed + Store (one at a time) ──
    const source = "Placement_Assistance_RAG_System.pdf";
    await RagChunk.deleteMany({ source });
    console.log("[RAG] Step 3+4: Embedding + storing one at a time...\n");

    let stored = 0;
    let errors = 0;

    for (const chunk of chunks) {
        try {
            const embedding = await getEmbedding(chunk.text, geminiKey);

            await RagChunk.create({
                source,
                chunkIndex: chunk.chunkIndex,
                text: chunk.text,
                embedding,
                metadata: { charStart: chunk.charStart, charEnd: chunk.charEnd },
            });

            stored++;
            if (stored % 10 === 0 || stored === chunks.length) {
                console.log(`[RAG]    ${stored}/${chunks.length} chunks stored`);
            }
        } catch (err: any) {
            errors++;
            console.error(`[RAG]    Chunk ${chunk.chunkIndex} failed: ${err.message}`);

            // Rate limit — wait longer
            if (err.message.includes("429") || err.message.includes("RATE")) {
                console.log("[RAG]    Rate limited, waiting 10s...");
                await sleep(10000);
                // Retry once
                try {
                    const embedding = await getEmbedding(chunk.text, geminiKey);
                    await RagChunk.create({
                        source,
                        chunkIndex: chunk.chunkIndex,
                        text: chunk.text,
                        embedding,
                        metadata: { charStart: chunk.charStart, charEnd: chunk.charEnd },
                    });
                    stored++;
                    errors--;
                } catch {
                    console.error(`[RAG]    Retry also failed for chunk ${chunk.chunkIndex}`);
                }
            }
        }

        await sleep(DELAY_MS);
    }

    console.log(`\n=== Ingestion Complete ===`);
    console.log(`  Source:  ${source}`);
    console.log(`  Text:    ${rawText.length} chars`);
    console.log(`  Chunks:  ${stored} stored, ${errors} errors`);

    const count = await RagChunk.countDocuments({ source });
    console.log(`  DB:      ${count} chunks in ragchunks collection`);

    await mongoose.disconnect();
    process.exit(0);
}

main().catch((err) => {
    console.error("Fatal:", err);
    process.exit(1);
});
