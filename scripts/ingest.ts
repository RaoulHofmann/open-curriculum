// @ts-ignore
import Database from "better-sqlite3";
import { pipeline } from "@huggingface/transformers";
import { resolve } from "node:path";
import { readFileSync, existsSync } from "node:fs";
import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";

const MODELS = [
  {
    id: "Xenova/all-MiniLM-L6-v2",
    dimension: 384,
    outFile: "curriculum-384.sqlite",
  },
  {
    id: "mixedbread-ai/mxbai-embed-large-v1",
    dimension: 1024,
    outFile: "curriculum-1024.sqlite",
  },
];

const CONTENT_CODE_RE = /(WA\d[A-Z0-9]+)/g;
const FOR_EXAMPLE_RE = /For example:/i;
const GC_LINE_RE = /General Capabilities:\s*(.*)/i;
const BULLET_RE = /^[•\-\*]\s*/;
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
  page: number;
}

interface Chunk {
  text: string;
  code: string;
  page: number;
  metadata: {
    yearLevel: number;
    strand: string;
    substrand: string;
    code: string;
    examples: string[];
    generalCapabilities?: string[];
  };
  image?: {
    data: Buffer;
    type: string;
  };
}

async function extractTextAndPageBounds(
  filePath: string,
): Promise<{ text: string; pageBoundaries: number[] }> {
  const data = new Uint8Array(readFileSync(filePath));
  const loadingTask = pdfjsLib.getDocument({ data });
  const pdf = await loadingTask.promise;
  const pages: string[] = [];
  const pageBoundaries: number[] = [];
  let offset = 0;

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const text = content.items.map((item: any) => item.str).join("\n");
    pages.push(text);
    pageBoundaries.push(offset);
    offset += text.length + 1;
  }

  return { text: pages.join("\n"), pageBoundaries };
}

async function extractImagesFromPDF(
  filePath: string,
): Promise<Map<number, { data: Buffer; type: string }>> {
  const data = new Uint8Array(readFileSync(filePath));
  const loadingTask = pdfjsLib.getDocument({ data });
  const pdf = await loadingTask.promise;
  const images = new Map<number, { data: Buffer; type: string }>();

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const operatorList = await page.getOperatorList();
    const commonObjs = page.commonObjs;
    const pageObjs = page.objs;

    for (let i = 0; i < operatorList.fnArray.length; i++) {
      const fn = operatorList.fnArray[i];

      // OPS.paintImageXObject = 85
      if (fn === 85) {
        const args = operatorList.argsArray[i];
        const imgName = args?.[0];
        if (!imgName) continue;

        try {
          let imgObj = pageObjs.get(imgName) ?? commonObjs.get(imgName);

          if (imgObj && imgObj.data) {
            const imgData = imgObj.data as Uint8Array;
            const width = imgObj.width ?? 0;
            const height = imgObj.height ?? 0;

            if (width < 50 || height < 50) continue;

            let type = "image/png";
            if (imgData[0] === 0xff && imgData[1] === 0xd8) {
              type = "image/jpeg";
            } else if (
              imgData[0] === 0x47 &&
              imgData[1] === 0x49 &&
              imgData[2] === 0x46
            ) {
              type = "image/gif";
            }

            images.set(pageNum, {
              data: Buffer.from(imgData),
              type,
            });
            break;
          }
        } catch {
          // Skip if image can't be retrieved
        }
      }
    }
  }

  return images;
}

function getPageForCharOffset(
  offset: number,
  pageBoundaries: number[],
): number {
  let page = 1;
  for (let i = 0; i < pageBoundaries.length; i++) {
    if (offset >= pageBoundaries[i]!) {
      page = i + 1;
    } else {
      break;
    }
  }
  return page;
}

function cleanText(text: string): string {
  return text
    .replace(/(\d)\n(\d)/g, "$1/$2")
    .replace(/\|\s*/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function parseAndChunk(rawText: string, pageBoundaries: number[]): Chunk[] {
  const lines = rawText.split("\n");

  let activeYear = 0;
  let activeStrand = "Unknown";
  let activeSubstrand = "Unknown";

  const lineContexts: LineContext[] = [];
  let pendingSubstrand = false;
  let charOffset = 0;

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

    const page = getPageForCharOffset(charOffset, pageBoundaries);

    lineContexts.push({
      year: activeYear,
      strand: activeStrand,
      substrand: activeSubstrand,
      page,
    });

    charOffset += raw.length + 1;
  }

  const sections = rawText.split(CONTENT_CODE_RE);
  const chunks: Chunk[] = [];
  let sectionOffset = 0;

  for (let i = 1; i < sections.length; i += 2) {
    const preceding = sections[i - 1] ?? "";
    const code = sections[i]!;
    const body = sections[i + 1] ?? "";

    if (!code || !body.trim()) {
      sectionOffset += preceding.length + code.length;
      continue;
    }

    const codeCharPos = sectionOffset + preceding.length;
    const lineIndex = rawText.slice(0, codeCharPos).split("\n").length - 1;
    const ctx = lineContexts[Math.min(lineIndex, lineContexts.length - 1)]!;

    sectionOffset += preceding.length + code.length;

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
      page: ctx.page,
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

function float32ArrayToBuffer(arr: Float32Array): Buffer {
  return Buffer.from(arr.buffer, arr.byteOffset, arr.byteLength);
}

async function ingest() {
  const pdfPath = process.argv[2] ?? "curriculum.pdf";
  const targetModel = process.argv[3];

  if (!existsSync(pdfPath)) {
    console.error(`PDF file not found: ${pdfPath}`);
    console.log("Usage: npm run ingest -- <path-to-pdf> [model-id]");
    process.exit(1);
  }

  console.log(`Parsing PDF: ${pdfPath}`);
  const { text, pageBoundaries } = await extractTextAndPageBounds(pdfPath);
  const chunks = parseAndChunk(text, pageBoundaries);
  console.log(`Parsed ${chunks.length} curriculum items`);

  console.log("Extracting images from PDF...");
  const pageImages = await extractImagesFromPDF(pdfPath);
  console.log(`Found ${pageImages.size} images`);

  for (const chunk of chunks) {
    const img = pageImages.get(chunk.page);
    if (img) {
      chunk.image = img;
    }
  }

  for (const model of MODELS) {
    if (targetModel && model.id !== targetModel) continue;

    console.log(`\nIngesting for ${model.id} (${model.dimension}d)...`);

    const pipe = await pipeline("feature-extraction", model.id);
    const embeddings: Float32Array[] = [];

    for (let i = 0; i < chunks.length; i++) {
      const output = await pipe(chunks[i]!.text, {
        pooling: "mean",
        normalize: true,
      });
      embeddings.push(new Float32Array(output.data as Float32Array));
      if ((i + 1) % 10 === 0 || i === chunks.length - 1) {
        process.stdout.write(`\r  Embedded ${i + 1}/${chunks.length}`);
      }
    }
    console.log();

    const dbPath = resolve(model.outFile);
    const db = new Database(dbPath);

    db.pragma("journal_mode = WAL");

    db.exec(`
      CREATE TABLE IF NOT EXISTS curriculum_items (
        id INTEGER PRIMARY KEY,
        code TEXT NOT NULL,
        text TEXT NOT NULL,
        year_level INTEGER,
        strand TEXT,
        substrand TEXT,
        examples TEXT,
        capabilities TEXT,
        image_data BLOB,
        image_type TEXT
      )
    `);

    db.exec(`
      CREATE TABLE IF NOT EXISTS embeddings (
        id INTEGER PRIMARY KEY,
        curriculum_id INTEGER NOT NULL,
        embedding BLOB NOT NULL,
        FOREIGN KEY (curriculum_id) REFERENCES curriculum_items(id)
      )
    `);

    db.exec("DELETE FROM embeddings");
    db.exec("DELETE FROM curriculum_items");

    db.exec("CREATE INDEX IF NOT EXISTS idx_year_level ON curriculum_items(year_level)");
    db.exec("CREATE INDEX IF NOT EXISTS idx_strand ON curriculum_items(strand)");
    db.exec("CREATE INDEX IF NOT EXISTS idx_substrand ON curriculum_items(substrand)");
    db.exec("CREATE INDEX IF NOT EXISTS idx_code ON curriculum_items(code)");

    const insertItem = db.prepare(
      "INSERT INTO curriculum_items (id, code, text, year_level, strand, substrand, examples, capabilities, image_data, image_type) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
    );

    const insertEmbedding = db.prepare(
      "INSERT INTO embeddings (id, curriculum_id, embedding) VALUES (?, ?, ?)"
    );

    const insertAll = db.transaction(() => {
      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i]!;
        const meta = chunk.metadata;

        insertItem.run(
          i + 1,
          chunk.code,
          chunk.text,
          meta.yearLevel,
          meta.strand,
          meta.substrand,
          JSON.stringify(meta.examples ?? []),
          JSON.stringify(meta.generalCapabilities ?? []),
          chunk.image ? chunk.image.data : null,
          chunk.image ? chunk.image.type : null
        );

        insertEmbedding.run(i + 1, i + 1, float32ArrayToBuffer(embeddings[i]!));
      }
    });

    insertAll();
    db.close();

    console.log(`  Wrote ${dbPath}`);
  }

  console.log("\nDone");
}

ingest().catch(console.error);
