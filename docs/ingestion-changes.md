// Proposed changes to ingest.ts to separate description into its own field
// This makes display cleaner and search more targeted

// ============================================
// 1. Update the Chunk interface (line ~42)
// ============================================

interface Chunk {
  text: string;           // Combined text for embedding (unchanged)
  code: string;
  page: number;
  metadata: {
    yearLevel: number;
    strand: string;
    substrand: string;
    code: string;
    description: string;  // NEW: separate description field
    examples: string[];
    generalCapabilities?: string[];
  };
  image?: {
    data: Buffer;
    type: string;
  };
}

// ============================================
// 2. Update parseAndChunk function (line ~225-269)
// ============================================

// Current code builds text like this:
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

// Change to:
const cleanedDescription = cleanText(description);

// Keep the combined text for embedding (good for search)
const text = [
  `Content code: ${code}`,
  `Year level: ${ctx.year}`,
  `Strand: ${ctx.strand}`,
  `Sub-strand: ${ctx.substrand}`,
  `Description: ${cleanedDescription}`,
  examples.length ? `Examples: ${examples.join(" | ")}` : "",
  generalCapabilities.length
    ? `Capabilities: ${generalCapabilities.join(", ")}`
    : "",
]
  .filter(Boolean)
  .join("\n");

// Update chunk to include description separately
chunks.push({
  code,
  text,
  page: ctx.page,
  metadata: {
    yearLevel: ctx.year,
    strand: ctx.strand,
    substrand: ctx.substrand,
    code,
    description: cleanedDescription,  // NEW: store clean description
    examples,
    ...(generalCapabilities.length ? { generalCapabilities } : {}),
  },
});

// ============================================
// 3. Update SQLite schema (line ~330-343)
// ============================================

// Current:
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

// Change to:
db.exec(`
  CREATE TABLE IF NOT EXISTS curriculum_items (
    id INTEGER PRIMARY KEY,
    code TEXT NOT NULL,
    text TEXT NOT NULL,
    description TEXT,
    year_level INTEGER,
    strand TEXT,
    substrand TEXT,
    examples TEXT,
    capabilities TEXT,
    image_data BLOB,
    image_type TEXT
  )
`);

// ============================================
// 4. Update insert statement (line ~362-364)
// ============================================

// Current:
const insertItem = db.prepare(
  "INSERT INTO curriculum_items (id, code, text, year_level, strand, substrand, examples, capabilities, image_data, image_type) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
);

// Change to:
const insertItem = db.prepare(
  "INSERT INTO curriculum_items (id, code, text, description, year_level, strand, substrand, examples, capabilities, image_data, image_type) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
);

// ============================================
// 5. Update insertAll transaction (line ~370-390)
// ============================================

// Current:
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

// Change to:
insertItem.run(
  i + 1,
  chunk.code,
  chunk.text,
  meta.description,  // NEW: pass description
  meta.yearLevel,
  meta.strand,
  meta.substrand,
  JSON.stringify(meta.examples ?? []),
  JSON.stringify(meta.generalCapabilities ?? []),
  chunk.image ? chunk.image.data : null,
  chunk.image ? chunk.image.type : null
);

// ============================================
// 6. Update search.ts EmbeddingResult interface (line ~73)
// ============================================

export interface EmbeddingResult {
  id: number;
  code: string;
  text: string;
  description: string | null;  // NEW
  year_level: number | null;
  strand: string | null;
  substrand: string | null;
  examples: string;
  capabilities: string;
  image_data: Uint8Array | null;
  image_type: string | null;
  distance: number;
}

// Update the query in searchEmbeddings (line ~96-101):
const sql = `
  SELECT c.id, c.code, c.text, c.description, c.year_level, c.strand, c.substrand, c.examples, c.capabilities, c.image_data, c.image_type, e.embedding
  FROM curriculum_items c
  JOIN embeddings e ON e.curriculum_id = c.id
  ${where}
`;

// Update the result mapping (line ~113-125):
return {
  id: row.id as number,
  code: row.code as string,
  text: row.text as string,
  description: row.description as string | null,  // NEW
  year_level: row.year_level as number | null,
  strand: row.strand as string | null,
  substrand: row.substrand as string | null,
  examples: row.examples as string,
  capabilities: row.capabilities as string,
  image_data: row.image_data as Uint8Array | null,
  image_type: row.image_type as string | null,
  distance: baseDistance * (1 - boost),
};

// ============================================
// 7. Update types/search.ts
// ============================================

export interface ChunkMetadata {
  year_level: number | null;
  strand: string | null;
  substrand: string | null;
  code: string;
  title?: string;
  description: string | null;  // NEW
  examples: string[];
  capabilities: string[];
  image_url?: string;
}

export interface SearchResult {
  code: string;
  text: string;
  description: string | null;  // NEW
  distance: number;
  meta: ChunkMetadata;
}

// ============================================
// 8. Update composables/useCurriculum.ts buildMeta function
// ============================================

function buildMeta(row: Record<string, any>): SearchResult["meta"] {
  return {
    year_level: row.year_level as number | null,
    strand: row.strand as string | null,
    substrand: row.substrand as string | null,
    code: row.code as string,
    description: row.description as string | null,  // NEW
    examples: JSON.parse((row.examples as string) ?? "[]"),
    capabilities: JSON.parse((row.capabilities as string) ?? "[]"),
    image_url: buildImageUrl(
      row.image_data as Uint8Array | null,
      row.image_type as string | null,
    ),
  };
}

// Update the search function to include description in queries
// In the direct code lookup (line ~74):
const row = await queryOne(
  "SELECT code, text, description, year_level, strand, substrand, examples, capabilities, image_data, image_type FROM curriculum_items WHERE code = ?",
  [queryTrimmed],
);

// In the results mapping (line ~108-123):
results.value = topK
  .slice(0, 5)
  .map((row) => ({
    code: row.code,
    text: row.text,
    description: row.description,  // NEW
    distance: row.distance,
    meta: {
      year_level: row.year_level,
      strand: row.strand,
      substrand: row.substrand,
      code: row.code,
      description: row.description,  // NEW
      examples: JSON.parse(row.examples ?? "[]"),
      capabilities: JSON.parse(row.capabilities ?? "[]"),
      image_url: buildImageUrl(row.image_data, row.image_type),
    },
  }));

// ============================================
// BENEFITS OF THIS APPROACH:
// ============================================

// 1. Display: You can use source.description directly instead of parsing
//    No more parseDescription() function needed in Vue components

// 2. Search: The combined `text` field is still used for embedding,
//    so search quality is unchanged

// 3. Clean data: Description is a clean string without "Content code:", 
//    "Year level:", etc. prefixes

// 4. Flexibility: You can show just the description, or combine with
//    examples/capabilities as needed

// ============================================
// EXAMPLE USAGE IN VUE AFTER CHANGES:
// ============================================

// Instead of:
// <p>{{ parseDescription(source.text).description }}</p>

// You can use:
// <p>{{ source.description }}</p>

// Or for multi-line display:
// <p v-for="(line, i) in source.description?.split('. ')" :key="i">
//   {{ line }}{{ line.endsWith('.') ? '' : '.' }}
// </p>