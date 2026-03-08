/**
 * RAG Ingestion — Pure Node.js (no tsx)
 * Run: node --max-old-space-size=4096 server/scripts/ingest.mjs
 */

import fs from "fs";
import path from "path";
import mongoose from "mongoose";
import dotenv from "dotenv";

// Load .env from server/
dotenv.config({ path: path.resolve(process.cwd(), "server", ".env") });

const CHUNK_SIZE = 500;
const CHUNK_OVERLAP = 100;
const DELAY_MS = 400;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ── Inline schema ──
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

// ── Chunking ──
function chunkText(fullText) {
    const chunks = [];
    let start = 0;
    let idx = 0;
    while (start < fullText.length) {
        let end = Math.min(start + CHUNK_SIZE, fullText.length);
        if (end < fullText.length) {
            const slice = fullText.slice(start, end);
            const bp = Math.max(slice.lastIndexOf("."), slice.lastIndexOf("\n"));
            if (bp > CHUNK_SIZE * 0.3) end = start + bp + 1;
        }
        const text = fullText.slice(start, end).trim();
        if (text.length > 20) chunks.push({ text, charStart: start, charEnd: end, chunkIndex: idx++ });
        start = end - CHUNK_OVERLAP;
        if (start >= fullText.length) break;
    }
    return chunks;
}

// ── Embedding via raw fetch ──
async function getEmbedding(text, apiKey) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key=${apiKey}`;
    const resp = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: { parts: [{ text }] } }),
    });
    if (!resp.ok) throw new Error(`Embedding API ${resp.status}: ${await resp.text()}`);
    const data = await resp.json();
    return data.embedding.values;
}

// ── Main ──
async function main() {
    console.log("=== RAG Ingestion ===\n");

    const geminiKey = process.env.STUDY_GEMINI_API_KEY || process.env.INTERVIEW_GEMINI_API_KEY || process.env.GEMINI_API_KEY;
    if (!geminiKey) { console.error("No Gemini API key"); process.exit(1); }

    // MongoDB
    const mongoUri = process.env.MONGODB_URI || "";
    const uri = mongoUri.includes("/placeprep") ? mongoUri : mongoUri.replace(/\/[^/?]*(\?|$)/, "/placeprep$1");
    await mongoose.connect(uri);
    console.log(`MongoDB connected (${mongoose.connection.name})\n`);

    // Text
    const txtPath = path.resolve(process.cwd(), "Placement_Assistance_RAG_System.txt");
    if (!fs.existsSync(txtPath)) {
        console.error("Run 'npx tsx server/src/scripts/testPdf.ts' first to extract text");
        process.exit(1);
    }
    const rawText = fs.readFileSync(txtPath, "utf-8");
    console.log(`Text: ${rawText.length} chars`);

    // Chunk
    const chunks = chunkText(rawText);
    console.log(`Chunks: ${chunks.length}\n`);

    // Embed + Store
    const source = "Placement_Assistance_RAG_System.pdf";
    await RagChunk.deleteMany({ source });

    let stored = 0;
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
            if (stored % 10 === 0) console.log(`  ${stored}/${chunks.length}`);
        } catch (err) {
            console.error(`  Chunk ${chunk.chunkIndex} failed: ${err.message}`);
            if (err.message.includes("429")) {
                console.log("  Rate limited, waiting 10s...");
                await sleep(10000);
            }
        }
        await sleep(DELAY_MS);
    }

    console.log(`\n=== Done: ${stored}/${chunks.length} chunks stored ===`);
    const count = await RagChunk.countDocuments({ source });
    console.log(`DB has ${count} chunks`);
    await mongoose.disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
