/**
 * Build-time ingestion script.
 *
 * Usage: bun run ingest [path-to-pdf]
 *
 * 1. Parses the curriculum PDF into chunks
 * 2. Generates embeddings with @huggingface/transformers (all-MiniLM-L6-v2, 384 dims)
 * 3. Stores everything in a Turso SQLite database (public/curriculum.db)
 */

import { connect } from "@tursodatabase/database";
import { PDFReader } from "@llamaindex/readers/pdf";
import * as fs from "node:fs/promises";
import * as path from "node:path";

const DB_PATH = path.resolve("public/curriculum.db");
const PDF_PATH = process.argv[2] || "scripts/curriculum.pdf";

const CONTENT_CODE_RE = /(WA\d[A-Z0-9]+)/g;
const FOR_EXAMPLE_RE = /For example:/i;
const GC_LINE_RE = /General Capabilities:\s*(.*)/i;
const BULLET_RE = /^[•\-\*]\s*/;

interface Chunk {
  text: string;
  code: string;
  metadata: {
    yearLevel: number;
    strand: string;
    substrand: string;
    code: string;
    examples: string[];
    generalCapabilities?: string[];
  };
}

async function parseAndChunkPDF(filePath: string): Promise<Chunk[]> {
  const reader = new PDFReader();
  const buffer = await fs.readFile(filePath);
  const pdfDocs = await reader.loadDataAsContent(buffer);
  const rawText = pdfDocs.map((d) => d.text).join("\n");

  const lines = rawText.split("\n");

  let activeYear = 0;
  let activeStrand = "Unknown";
  let activeSubstrand = "Unknown";

  const KNOWN_STRANDS = new Set([
    "Number and algebra",
    "Measurement and geometry",
    "Probability and statistics",
    "Algebra",
    "Space",
    "Statistics",
    "Probability",
  ]);

  interface LineContext {
    year: number;
    strand: string;
    substrand: string;
  }
  const lineContexts: LineContext[] = [];

  let pendingSubstrand = false;

  for (let li = 0; li < lines.length; li++) {
    const raw = lines[li]!;
    const line = raw.replace(/\f/g, "").trim();
    const yearMatch = line.match(/^Year\s+(\d+)[A-Za-z]?$/i);

    if (yearMatch) {
      activeYear = Number(yearMatch[1]);
      pendingSubstrand = false;
    } else if (KNOWN_STRANDS.has(line)) {
      activeStrand = line;
      activeSubstrand = "Unknown";
      pendingSubstrand = true;
    } else if (pendingSubstrand && line.length > 0) {
      activeSubstrand = line;
      pendingSubstrand = false;
    }

    lineContexts.push({
      year: activeYear,
      strand: activeStrand,
      substrand: activeSubstrand,
    });
  }

  const sections = rawText.split(CONTENT_CODE_RE);
  const chunks: Chunk[] = [];

  let charOffset = 0;

  for (let i = 1; i < sections.length; i += 2) {
    const preceding = sections[i - 1] ?? "";
    const code = sections[i]!;
    const body = sections[i + 1] ?? "";
    if (!code || !body.trim()) {
      charOffset += preceding.length + code.length;
      continue;
    }

    const codeCharPos = charOffset + preceding.length;
    const lineIndex = rawText.slice(0, codeCharPos).split("\n").length - 1;
    const ctx = lineContexts[Math.min(lineIndex, lineContexts.length - 1)]!;

    charOffset += preceding.length + code.length;

    const exampleMatch = FOR_EXAMPLE_RE.exec(body);
    const description = exampleMatch
      ? body.slice(0, exampleMatch.index).trim()
      : body.trim();
    const afterExamples = exampleMatch ? body.slice(exampleMatch.index) : "";

    const gcMatch = GC_LINE_RE.exec(afterExamples);
    const generalCapabilities = gcMatch
      ? gcMatch[1]!.split(",").map((s) => s.trim())
      : [];

    const examples = afterExamples
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => BULLET_RE.test(l) || l.length > 20)
      .map((l) => l.replace(BULLET_RE, ""))
      .slice(0, 6);

    function cleanText(text: string): string {
      return text
        .replace(/(\d)\n(\d)/g, "$1/$2")
        .replace(/\|\s*/g, " ")
        .replace(/\s{2,}/g, " ")
        .trim();
    }

    const text = [
      `Content code: ${code}`,
      `Year level: ${ctx.year}`,
      `Strand: ${ctx.strand}`,
      `Sub-strand: ${ctx.substrand}`,
      `Description: ${cleanText(description)}`,
      examples.length ? `Examples: ${examples.join(" | ")}` : "",
      generalCapabilities.length
        ? `Capabilities: ${generalCapabilities.join(", ")}`
        : "",
    ]
      .filter(Boolean)
      .join("\n");

    chunks.push({
      code,
      text,
      metadata: {
        yearLevel: ctx.year,
        strand: ctx.strand,
        substrand: ctx.substrand,
        code,
        examples,
        ...(generalCapabilities.length ? { generalCapabilities } : {}),
      },
    });
  }

  return chunks;
}

async function generateEmbeddings(
  texts: string[],
  onProgress?: (i: number, total: number) => void,
): Promise<Float32Array[]> {
  const { pipeline } = await import("@huggingface/transformers");
  const extractor = await pipeline(
    "feature-extraction",
    "Xenova/all-MiniLM-L6-v2",
  );

  const results: Float32Array[] = [];

  for (let i = 0; i < texts.length; i++) {
    const output = await extractor(texts[i], {
      pooling: "mean",
      normalize: true,
    });
    results.push(new Float32Array(output.data as Float32Array));
    onProgress?.(i + 1, texts.length);
  }

  return results;
}

async function main() {
  console.log("Parsing PDF...");
  const chunks = await parseAndChunkPDF(PDF_PATH);
  console.log(`Parsed ${chunks.length} chunks`);

  console.log("Generating embeddings (this may take a while)...");
  const embeddings = await generateEmbeddings(
    chunks.map((c) => c.text),
    (i, total) => {
      if (i % 10 === 0 || i === total) {
        console.log(`  Embedding ${i}/${total}`);
      }
    },
  );

  // Ensure public directory exists
  await fs.mkdir(path.dirname(DB_PATH), { recursive: true });

  // Remove existing database
  try {
    await fs.unlink(DB_PATH);
  } catch {}

  console.log("Creating Turso database...");
  const db = await connect(DB_PATH);

  await db.exec(`
    CREATE TABLE IF NOT EXISTS chunks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      text TEXT NOT NULL,
      code TEXT NOT NULL,
      metadata TEXT NOT NULL,
      embedding BLOB NOT NULL
    )
  `);

  const insertStmt = db.prepare(
    "INSERT INTO chunks (text, code, metadata, embedding) VALUES (?, ?, ?, ?)",
  );

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i]!;
    await insertStmt.run(
      chunk.text,
      chunk.code,
      JSON.stringify(chunk.metadata),
      Buffer.from(embeddings[i]!.buffer),
    );

    if ((i + 1) % 10 === 0 || i + 1 === chunks.length) {
      console.log(`  Inserted ${i + 1}/${chunks.length}`);
    }
  }

  console.log(`Database written to ${DB_PATH}`);

  // Checkpoint WAL to merge into main DB file
  await db.exec("PRAGMA wal_checkpoint(TRUNCATE)");
  await db.close();

  // Remove WAL/SHM files
  try { await fs.unlink(`${DB_PATH}-wal`); } catch {}
  try { await fs.unlink(`${DB_PATH}-shm`); } catch {}

  console.log("Done!");
}

main().catch((err) => {
  console.error("Ingestion failed:", err);
  process.exit(1);
});
