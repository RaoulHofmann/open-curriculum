import { loadDatabase, queryAll } from "./db";
import type { EmbeddingModel } from "./models";
import type { SearchFilters } from "~/types/search";

function textMatchScore(query: string, text: string): number {
  const lowerQuery = query.toLowerCase();
  const lowerText = text.toLowerCase();

  if (lowerText.includes(lowerQuery)) return 1;

  const words = lowerQuery.split(/\s+/).filter((w) => w.length > 2);
  if (words.length === 0) return 0;

  const matched = words.filter((w) => lowerText.includes(w)).length;
  return matched / words.length;
}

function cosineDistance(a: Float32Array, b: Float32Array): number {
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i]! * b[i]!;
    normA += a[i]! * a[i]!;
    normB += b[i]! * b[i]!;
  }
  return 1 - dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

function buildFilterSQL(filters?: SearchFilters): { where: string; params: any[] } {
  const conditions: string[] = [];
  const params: any[] = [];

  if (!filters) return { where: "", params: [] };

  if (filters.code !== undefined && filters.code.length > 0) {
    conditions.push("c.code LIKE ?");
    params.push(`%${filters.code}%`);
  }

  if (filters.yearLevel !== undefined) {
    const years = Array.isArray(filters.yearLevel) ? filters.yearLevel : [filters.yearLevel];
    if (years.length === 1) {
      conditions.push("c.year_level = ?");
      params.push(years[0]);
    } else {
      conditions.push(`c.year_level IN (${years.map(() => "?").join(",")})`);
      params.push(...years);
    }
  }

  if (filters.strand !== undefined) {
    const strands = Array.isArray(filters.strand) ? filters.strand : [filters.strand];
    if (strands.length === 1) {
      conditions.push("c.strand = ?");
      params.push(strands[0]);
    } else {
      conditions.push(`c.strand IN (${strands.map(() => "?").join(",")})`);
      params.push(...strands);
    }
  }

  if (filters.substrand !== undefined) {
    const substrands = Array.isArray(filters.substrand) ? filters.substrand : [filters.substrand];
    if (substrands.length === 1) {
      conditions.push("c.substrand = ?");
      params.push(substrands[0]);
    } else {
      conditions.push(`c.substrand IN (${substrands.map(() => "?").join(",")})`);
      params.push(...substrands);
    }
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  return { where, params };
}

export interface EmbeddingResult {
  id: number;
  code: string;
  text: string;
  year_level: number | null;
  strand: string | null;
  substrand: string | null;
  examples: string;
  capabilities: string;
  distance: number;
}

export async function searchEmbeddings(
  model: EmbeddingModel,
  queryVector: Float32Array,
  k: number,
  filters?: SearchFilters,
  queryText?: string,
): Promise<EmbeddingResult[]> {
  await loadDatabase(model);
  const { where, params } = buildFilterSQL(filters);
  const sql = `
    SELECT c.id, c.code, c.text, c.year_level, c.strand, c.substrand, c.examples, c.capabilities, e.embedding
    FROM curriculum_items c
    JOIN embeddings e ON e.curriculum_id = c.id
    ${where}
  `;

  const rows = await queryAll(sql, params);
  const results: EmbeddingResult[] = rows.map((row) => {
    const embedding = new Float32Array(
      (row.embedding as Uint8Array).buffer,
      (row.embedding as Uint8Array).byteOffset,
      (row.embedding as Uint8Array).byteLength / 4,
    );
    const baseDistance = cosineDistance(queryVector, embedding);
    const boost = queryText ? 0.3 * textMatchScore(queryText, row.text as string) : 0;

    return {
      id: row.id as number,
      code: row.code as string,
      text: row.text as string,
      year_level: row.year_level as number | null,
      strand: row.strand as string | null,
      substrand: row.substrand as string | null,
      examples: row.examples as string,
      capabilities: row.capabilities as string,
      distance: baseDistance * (1 - boost),
    };
  });

  results.sort((a, b) => a.distance - b.distance);

  if (filters?.minSimilarity !== undefined) {
    const threshold = 1 - filters.minSimilarity;
    return results.filter((r) => r.distance <= threshold).slice(0, k);
  }

  return results.slice(0, k);
}
