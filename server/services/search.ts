import { sqlite } from "../db";
import { SearchResult } from "../types";
import { getOllamaEmbedding } from "./embedding";

const CONTENT_CODE_RE = /^WA\d[A-Z0-9]+$/;
const YEAR_RE = /(?:year\s+)(\d+)|(\d+)(?:\s+year)/i;

async function expandQuery(query: string): Promise<string> {
  // Wrap bare keywords in a natural sentence
  if (query.split(" ").length <= 2) {
    return `curriculum content about ${query}`;
  }
  return query;
}

export async function searchKnowledgeBase(
  userQuery: string,
  k = 5,
): Promise<SearchResult[]> {
  const queryTrimmed = userQuery.trim();

  if (CONTENT_CODE_RE.test(queryTrimmed)) {
    const row = sqlite
      .prepare(`SELECT text, code, metadata FROM chunk_content WHERE code = ?`)
      .get(userQuery.trim()) as any;

    if (!row) return [];

    return [
      {
        code: row.code,
        text: row.text,
        distance: 0, // exact match
        meta: JSON.parse(row.metadata),
      },
    ];
  }

  const match = queryTrimmed?.match(YEAR_RE);
  const hasYear = !!match;
  const year = hasYear ? match[1] : null;

  const expandedQuery = await expandQuery(queryTrimmed);
  const queryVector = await getOllamaEmbedding(expandedQuery);
  const vectorBuffer = new Float32Array(queryVector);

  const sql = `
    SELECT
      c.text,
      c.code,
      v.distance,
      c.metadata
    FROM vec_items v
    JOIN chunk_content c ON v.rowid = c.id
    WHERE v.embedding MATCH ? AND k = ?
    ${hasYear ? "AND json_extract(c.metadata, '$.yearLevel') = ?" : ""}
    ORDER BY distance
  `;

  const params: unknown[] = [vectorBuffer];
  params.push(k);

  if (hasYear) {
    params.push(year);
  }

  const rows = sqlite.prepare(sql).all(...params) as any[];

  return rows.map((c) => ({
    code: c.code,
    text: c.text,
    distance: c.distance,
    meta: JSON.parse(c.metadata),
  }));
}
