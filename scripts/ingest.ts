// @ts-ignore
import Database from "better-sqlite3";
import { pipeline } from "@huggingface/transformers";
import { resolve, join, basename } from "node:path";
import {
  readFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  writeFileSync,
  copyFileSync,
} from "node:fs";
import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";
import sharp from "sharp";

const MODELS = [
  {
    id: "Xenova/all-MiniLM-L6-v2",
    dimension: 384,
    outFile: "public/curriculum-384.sqlite",
  },
  {
    id: "mixedbread-ai/mxbai-embed-large-v1",
    dimension: 1024,
    outFile: "public/curriculum-1024.sqlite",
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
  sourceFile: string;
}

interface Chunk {
  text: string;
  code: string;
  page: number;
  sourceFile: string;
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

    const imgNames: string[] = [];
    for (let i = 0; i < operatorList.fnArray.length; i++) {
      if (operatorList.fnArray[i] === 85) {
        const name = operatorList.argsArray[i]?.[0];
        if (name) imgNames.push(name);
      }
    }
    if (imgNames.length === 0) continue;

    const resolveObj = (name: string): Promise<any> => {
      return new Promise((resolve) => {
        let delivered = false;
        const deliver = (obj: any) => {
          if (delivered) return;
          delivered = true;
          resolve(obj ?? null);
        };

        try {
          if (pageObjs.has(name)) {
            pageObjs.get(name, deliver);
          } else if (commonObjs.has(name)) {
            commonObjs.get(name, deliver);
          }
        } catch {
          // not yet registered
        }

        // Fallback: poll for up to 2s in case the callback never fires
        const deadline = Date.now() + 2000;
        const poll = () => {
          if (delivered) return;
          try {
            if (pageObjs.has(name)) {
              const obj = pageObjs.get(name);
              if (obj) return deliver(obj);
            }
            if (commonObjs.has(name)) {
              const obj = commonObjs.get(name);
              if (obj) return deliver(obj);
            }
          } catch {
            /* not resolved yet */
          }
          if (Date.now() < deadline) {
            setTimeout(poll, 50);
          } else {
            resolve(null);
          }
        };
        setTimeout(poll, 50);
      });
    };

    const resolved = new Map<string, any>();
    await Promise.all(
      imgNames.map(async (name) => {
        const obj = await resolveObj(name);
        if (obj) resolved.set(name, obj);
      }),
    );

    for (const imgName of imgNames) {
      try {
        const imgObj = resolved.get(imgName);
        if (!imgObj?.data) continue;

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

        let data: Buffer;
        if (type === "image/png") {
          data = await sharp(Buffer.from(imgData), {
            raw: { width, height, channels: 4 },
          })
            .png()
            .toBuffer();
        } else {
          data = Buffer.from(imgData);
        }

        images.set(pageNum, { data, type });
        break;
      } catch {
        // Skip if image can't be retrieved
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

function parseAndChunk(
  rawText: string,
  pageBoundaries: number[],
  sourceFile: string,
): Chunk[] {
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
      sourceFile,
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
      sourceFile: ctx.sourceFile,
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

async function downloadModels(): Promise<void> {
  console.log("\n=== Downloading Models ===\n");

  const modelsDir = resolve("public/models");
  if (!existsSync(modelsDir)) {
    mkdirSync(modelsDir, { recursive: true });
  }

  for (const model of MODELS) {
    console.log(`Downloading model: ${model.id}...`);

    try {
      // Use the pipeline to trigger model download
      // The models will be cached by the library
      const pipe = await pipeline("feature-extraction", model.id, {
        revision: "main",
      });

      console.log(`  ✓ Model ${model.id} downloaded and cached`);

      // Clean up the pipeline
      if (pipe && typeof pipe === "object" && "dispose" in pipe) {
        (pipe as any).dispose();
      }
    } catch (error) {
      console.error(`  ✗ Failed to download model ${model.id}:`, error);
      throw error;
    }
  }

  console.log("\n✓ All models downloaded successfully\n");
}

async function getPdfFiles(): Promise<string[]> {
  const pdfsDir = resolve("public/pdfs");

  if (!existsSync(pdfsDir)) {
    console.error(`PDFs directory not found: ${pdfsDir}`);
    console.log("Creating pdfs directory...");
    mkdirSync(pdfsDir, { recursive: true });
    return [];
  }

  const files = readdirSync(pdfsDir)
    .filter((file) => file.toLowerCase().endsWith(".pdf"))
    .map((file) => join(pdfsDir, file));

  return files;
}

async function ingest() {
  const targetModel = process.argv[2];

  // Get all PDF files from public/pdfs directory
  const pdfFiles = await getPdfFiles();

  if (pdfFiles.length === 0) {
    console.error("No PDF files found in public/pdfs directory");
    console.log("Please add PDF files to public/pdfs and run the script again");
    process.exit(1);
  }

  console.log(`Found ${pdfFiles.length} PDF file(s):`);
  pdfFiles.forEach((file) => console.log(`  - ${basename(file)}`));

  // Download models first
  await downloadModels();

  // Process all PDFs and collect chunks
  const allChunks: Chunk[] = [];

  for (const pdfPath of pdfFiles) {
    console.log(`\nProcessing: ${basename(pdfPath)}`);

    const { text, pageBoundaries } = await extractTextAndPageBounds(pdfPath);
    const chunks = parseAndChunk(text, pageBoundaries, basename(pdfPath));
    console.log(`  Found ${chunks.length} curriculum items`);

    console.log("  Extracting images...");
    const pageImages = await extractImagesFromPDF(pdfPath);
    console.log(`  Found ${pageImages.size} images`);

    for (const chunk of chunks) {
      const img = pageImages.get(chunk.page);
      if (img) {
        chunk.image = img;
      }
    }

    allChunks.push(...chunks);
  }

  console.log(`\nTotal curriculum items: ${allChunks.length}`);

  // Generate embeddings for each model
  for (const model of MODELS) {
    if (targetModel && model.id !== targetModel) continue;

    console.log(
      `\n=== Processing embeddings for ${model.id} (${model.dimension}d) ===\n`,
    );

    const pipe = await pipeline("feature-extraction", model.id);
    const embeddings: Float32Array[] = [];

    for (let i = 0; i < allChunks.length; i++) {
      const output = await pipe(allChunks[i]!.text, {
        pooling: "mean",
        normalize: true,
      });
      embeddings.push(new Float32Array(output.data as Float32Array));
      if ((i + 1) % 10 === 0 || i === allChunks.length - 1) {
        process.stdout.write(`\r  Embedded ${i + 1}/${allChunks.length}`);
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
        source_file TEXT,
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

    db.exec(
      "CREATE INDEX IF NOT EXISTS idx_year_level ON curriculum_items(year_level)",
    );
    db.exec(
      "CREATE INDEX IF NOT EXISTS idx_strand ON curriculum_items(strand)",
    );
    db.exec(
      "CREATE INDEX IF NOT EXISTS idx_substrand ON curriculum_items(substrand)",
    );
    db.exec("CREATE INDEX IF NOT EXISTS idx_code ON curriculum_items(code)");

    const insertItem = db.prepare(
      "INSERT INTO curriculum_items (id, code, text, year_level, strand, substrand, examples, capabilities, source_file, image_data, image_type) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    );

    const insertEmbedding = db.prepare(
      "INSERT INTO embeddings (id, curriculum_id, embedding) VALUES (?, ?, ?)",
    );

    const insertAll = db.transaction(() => {
      for (let i = 0; i < allChunks.length; i++) {
        const chunk = allChunks[i]!;
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
          chunk.sourceFile,
          chunk.image ? chunk.image.data : null,
          chunk.image ? chunk.image.type : null,
        );

        insertEmbedding.run(i + 1, i + 1, float32ArrayToBuffer(embeddings[i]!));
      }
    });

    insertAll();
    db.close();

    console.log(`  ✓ Wrote ${dbPath}`);
  }

  console.log("\n=== Ingest Complete ===\n");
}

ingest().catch((error) => {
  console.error("Ingest failed:", error);
  process.exit(1);
});
