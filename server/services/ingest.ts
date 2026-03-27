import { PDFReader } from "@llamaindex/readers/pdf";
import * as fs from "node:fs/promises";
import { sqlite } from "../db";
import { getOllamaEmbedding } from "./embedding";

const CONTENT_CODE_RE = /(WA\d[A-Z0-9]+)/g;
const FOR_EXAMPLE_RE = /For example:/i;
const GC_LINE_RE = /General Capabilities:\s*(.*)/i;
const BULLET_RE = /^[•\-\*]\s*/;

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

  const sections = rawText.split(CONTENT_CODE_RE);
  const chunks: Chunk[] = [];

  // Could be made dynamic based on PDF headers
  const meta = { yearLevel: "Year 2", strand: "Mathematics", substrand: "NA" };

  for (let i = 1; i < sections.length; i += 2) {
    const code = sections[i];
    const body = sections[i + 1] ?? "";
    if (!code || !body.trim()) continue;

    const exampleMatch = FOR_EXAMPLE_RE.exec(body);
    const description = exampleMatch
      ? body.slice(0, exampleMatch.index).trim()
      : body.trim();
    const afterExamples = exampleMatch ? body.slice(exampleMatch.index) : "";
    const gcMatch = GC_LINE_RE.exec(afterExamples);

    const generalCapabilities = gcMatch
      ? gcMatch?.[1]?.split(",").map((s) => s.trim())
      : [];

    const examples = afterExamples
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => BULLET_RE.test(l) || l.length > 20)
      .map((l) => l.replace(BULLET_RE, ""))
      .slice(0, 6);

    const text = [
      `Content code: ${code}`,
      `Year level: ${meta.yearLevel}`,
      `Description: ${description}`,
      examples.length ? `Examples: ${examples.join(" | ")}` : "",
      generalCapabilities?.length
        ? `Capabilities: ${generalCapabilities.join(", ")}`
        : "",
    ]
      .filter(Boolean)
      .join("\n");

    chunks.push({
      code,
      text,
      metadata: {
        ...meta,
        code,
        examples,
        ...(generalCapabilities?.length ? { generalCapabilities } : {}),
      },
    });
  }

  return chunks;
}

export async function ingest(filePath = "server/files/curriculum-2.pdf") {
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
