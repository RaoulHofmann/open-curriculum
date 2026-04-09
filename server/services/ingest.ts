import { PDFReader } from "@llamaindex/readers/pdf";
import * as fs from "node:fs/promises";
import { sqlite } from "../db";
import { getOllamaEmbedding } from "./embedding";

const CONTENT_CODE_RE = /(WA\d[A-Z0-9]+)/g;
const FOR_EXAMPLE_RE = /For example:/i;
const GC_LINE_RE = /General Capabilities:\s*(.*)/i;
const BULLET_RE = /^[•\-\*]\s*/;
const YEAR_RE = /(?:^|\f)(Year\s+\d+[A-Za-z]?)\s*\n/;
const STRAND_RE =
  /^(Number and algebra|Measurement and geometry|Probability and statistics|Algebra|Space|Statistics|Probability)$/im;

interface Chunk {
  text: string;
  code: string;
  metadata: {
    yearLevel: string;
    strand: string;
    substrand: string;
    code: string;
    examples: string[];
    generalCapabilities?: string[];
  };
}

export async function parseAndChunkPDF(filePath: string): Promise<Chunk[]> {
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
      activeYear = Number(yearMatch?.[1]);
      pendingSubstrand = false;
    }

    // Strand heading
    else if (KNOWN_STRANDS.has(line)) {
      activeStrand = line;
      activeSubstrand = "Unknown"; // reset until we see the next line
      pendingSubstrand = true;
    }

    // Substrand — the first non-empty line after a strand heading
    else if (pendingSubstrand && line.length > 0) {
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

export async function ingest(filePath = "server/files/curriculum.pdf") {
  console.log("Parsing PDF with LlamaIndex...");
  const chunks = await parseAndChunkPDF(filePath);

  const insertVec = sqlite.prepare(
    "INSERT INTO vec_items(rowid, embedding) VALUES (?, ?)",
  );
  const insertContent = sqlite.prepare(
    "INSERT INTO chunk_content(id, text, code, metadata) VALUES (?, ?, ?, ?)",
  );

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    if (!chunk) continue;
    try {
      const vector = await getOllamaEmbedding(chunk.text);
      const rowId = i + 1;

      insertVec.run(BigInt(rowId), new Float32Array(vector));
      insertContent.run(
        rowId,
        chunk.text,
        chunk.code,
        JSON.stringify(chunk.metadata),
      );

      console.log(`Ingested ${chunk.code} (${rowId}/${chunks.length})`);
    } catch (err) {
      console.error(`Error ingesting ${chunk.code}:`, err);
    }
  }

  return { ingested: chunks.length };
}
