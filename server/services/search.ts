import { sqlite } from "../db";
import { getOllamaEmbedding } from "./embedding";

interface SearchResult {
  code: string;
  text: string;
  distance: number;
  meta: Record<string, any>;
}

export async function searchKnowledgeBase(
  userQuery: string,
  k = 5,
): Promise<SearchResult[]> {
  const queryVector = await getOllamaEmbedding(userQuery);
  const vectorBuffer = new Float32Array(queryVector);

  const rows = sqlite
    .prepare(
      `
      SELECT
        c.text,
        c.code,
        v.distance,
        c.metadata
      FROM vec_items v
      JOIN chunk_content c ON v.rowid = c.id
      WHERE v.embedding MATCH ? AND k = ?
      ORDER BY distance
    `,
    )
    .all(vectorBuffer, k) as any[];

  return rows.map((c) => ({
    code: c.code,
    text: c.text,
    distance: c.distance,
    meta: JSON.parse(c.metadata),
  }));
}
