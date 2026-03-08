/**
 * ═══════════════════════════════════════════════════════════════
 *  RAG Ingestion — Memory-Efficient Pipeline
 * ═══════════════════════════════════════════════════════════════
 *
 *  Techniques applied:
 *  1. Streaming file read (line-by-line buffer)
 *  2. Small chunks (300 chars, 50 overlap)
 *  3. Sequential: read → chunk → embed → store → clear → next
 *  4. Embed only 1 chunk at a time
 *  5. Uses Gemini text-embedding-004 via raw fetch (no heavy SDK)
 *  6. Native MongoDB driver (no Mongoose overhead)
 *  7. Explicit GC after every batch
 *  8. Only current_chunk + current_embedding in RAM
 *  9. Character-based chunking (no tokenizer models)
 * 10. Offline preprocessing — stores to DB, runtime only retrieves
 *
 *  Run:  node --expose-gc scripts/ingest.mjs
 * ═══════════════════════════════════════════════════════════════
 */

import fs from "fs";
import path from "path";
import readline from "readline";
import { fileURLToPath } from "url";
import { MongoClient } from "mongodb";
import dotenv from "dotenv";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "..", ".env") });

// ── Config ──
const CHUNK_SIZE = 300;       // small chunks for minimal memory
const CHUNK_OVERLAP = 50;     // small overlap
const DELAY_MS = 300;         // rate limit between embeddings
const GC_EVERY = 5;           // garbage collect every N chunks

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const gc = () => { if (global.gc) global.gc(); };

// ── 1. Streaming File Reader ──
// Reads the text file line-by-line, never loads entire file
async function* streamTextLines(filePath) {
    const rl = readline.createInterface({
        input: fs.createReadStream(filePath, { encoding: "utf-8", highWaterMark: 1024 }),
        crlfDelay: Infinity,
    });
    for await (const line of rl) {
        yield line;
    }
}

// ── 2. Streaming Chunker ──
// Yields one chunk at a time, never keeps all chunks in memory
async function* streamChunks(filePath) {
    let buffer = "";
    let chunkIndex = 0;
    let charPos = 0;

    for await (const line of streamTextLines(filePath)) {
        buffer += line + "\n";

        while (buffer.length >= CHUNK_SIZE) {
            // Find a good break point
            let end = CHUNK_SIZE;
            const slice = buffer.slice(0, end);
            const bp = Math.max(slice.lastIndexOf("."), slice.lastIndexOf("\n"));
            if (bp > CHUNK_SIZE * 0.3) end = bp + 1;

            const text = buffer.slice(0, end).trim();
            if (text.length > 20) {
                yield {
                    text,
                    chunkIndex: chunkIndex++,
                    charStart: charPos,
                    charEnd: charPos + end,
                };
            }

            // Advance with overlap
            const advance = Math.max(1, end - CHUNK_OVERLAP);
            charPos += advance;
            buffer = buffer.slice(advance);
        }
    }

    // Flush remaining buffer
    const text = buffer.trim();
    if (text.length > 20) {
        yield {
            text,
            chunkIndex: chunkIndex++,
            charStart: charPos,
            charEnd: charPos + text.length,
        };
    }
}

// ── 3. Embedding via raw fetch (no SDK, minimal memory) ──
async function getEmbedding(text, apiKey) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent?key=${apiKey}`;

    const resp = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: { parts: [{ text }] } }),
    });

    if (!resp.ok) {
        const errText = await resp.text();
        throw new Error(`Embedding API ${resp.status}: ${errText.slice(0, 200)}`);
    }

    const data = await resp.json();
    const values = data.embedding.values;

    // Only keep the values array, let everything else be GC'd
    return values;
}

// ── Main Pipeline ──
async function main() {
    console.log("=== RAG Ingestion (Memory-Efficient) ===\n");

    const geminiKey = process.env.STUDY_GEMINI_API_KEY ||
        process.env.INTERVIEW_GEMINI_API_KEY ||
        process.env.GEMINI_API_KEY;

    if (!geminiKey) {
        console.error("[FAIL] No Gemini API key found in .env");
        process.exit(1);
    }

    // ── Connect to MongoDB (native driver, not Mongoose) ──
    let mongoUri = process.env.MONGODB_URI || "";
    if (!mongoUri.includes("/placeprep")) {
        mongoUri = mongoUri.replace(/\/[^/?]*(\?|$)/, "/placeprep$1");
    }

    const client = new MongoClient(mongoUri);
    await client.connect();
    const db = client.db("placeprep");
    const col = db.collection("ragchunks");
    console.log("[OK] MongoDB connected\n");

    // ── Resolve text file ──
    const txtPath = path.resolve(__dirname, "..", "..", "Placement_Assistance_RAG_System.txt");

    if (!fs.existsSync(txtPath)) {
        console.error(`[FAIL] Text file not found: ${txtPath}`);
        console.error("       Run the PDF extraction first or place the .txt file.");
        process.exit(1);
    }

    const fileSize = fs.statSync(txtPath).size;
    console.log(`[RAG] Text file: ${fileSize} bytes\n`);

    // ── Clear old data ──
    const source = "Placement_Assistance_RAG_System.pdf";
    const deleted = await col.deleteMany({ source });
    console.log(`[RAG] Cleared ${deleted.deletedCount} old chunks\n`);

    // ── Create index ──
    await col.createIndex({ source: 1, chunkIndex: 1 }, { unique: true }).catch(() => { });

    // ── Sequential Pipeline: stream → chunk → embed → store → clear ──
    console.log(`[RAG] Pipeline: chunk(${CHUNK_SIZE}) → embed → store → clear\n`);

    let stored = 0;
    let errors = 0;
    const startTime = Date.now();

    for await (const chunk of streamChunks(txtPath)) {
        try {
            // 3. Get embedding (only current chunk in memory)
            const embedding = await getEmbedding(chunk.text, geminiKey);

            // 4. Store immediately
            await col.insertOne({
                source,
                chunkIndex: chunk.chunkIndex,
                text: chunk.text,
                embedding,
                metadata: { charStart: chunk.charStart, charEnd: chunk.charEnd },
                createdAt: new Date(),
                updatedAt: new Date(),
            });

            stored++;

            // 5. Log progress
            if (stored % 10 === 0) {
                const heapMB = Math.round(process.memoryUsage().heapUsed / 1024 / 1024);
                const elapsed = Math.round((Date.now() - startTime) / 1000);
                console.log(`  ✓ ${stored} chunks stored (${heapMB}MB heap, ${elapsed}s)`);
            }

            // 7. GC after every N chunks
            if (stored % GC_EVERY === 0) gc();

        } catch (err) {
            errors++;
            console.error(`  ✗ Chunk ${chunk.chunkIndex}: ${err.message}`);

            // Rate limit handling
            if (err.message.includes("429") || err.message.includes("RESOURCE_EXHAUSTED")) {
                console.log("    Waiting 15s for rate limit...");
                await sleep(15000);
                gc();

                // Retry once
                try {
                    const embedding = await getEmbedding(chunk.text, geminiKey);
                    await col.insertOne({
                        source, chunkIndex: chunk.chunkIndex, text: chunk.text,
                        embedding, metadata: { charStart: chunk.charStart, charEnd: chunk.charEnd },
                        createdAt: new Date(), updatedAt: new Date(),
                    });
                    stored++;
                    errors--;
                } catch (e2) {
                    console.error(`    Retry failed: ${e2.message}`);
                }
            }
        }

        // Rate limit delay
        await sleep(DELAY_MS);
    }

    // ── Final stats ──
    const totalTime = Math.round((Date.now() - startTime) / 1000);
    const finalCount = await col.countDocuments({ source });
    const heapMB = Math.round(process.memoryUsage().heapUsed / 1024 / 1024);

    console.log(`\n=== Ingestion Complete ===`);
    console.log(`  Stored:   ${stored} chunks`);
    console.log(`  Errors:   ${errors}`);
    console.log(`  DB total: ${finalCount}`);
    console.log(`  Time:     ${totalTime}s`);
    console.log(`  Heap:     ${heapMB}MB`);

    await client.close();
    process.exit(0);
}

main().catch((e) => {
    console.error("Fatal:", e);
    process.exit(1);
});
