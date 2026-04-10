import type { SearchResult } from "~/types";

const CONTENT_CODE_RE = /^WA\d[A-Z0-9]+$/;
const YEAR_RE = /(?:year\s+)(\d+)|(\d+)(?:\s+year)/i;

/**
 * Pure DB search - only uses Turso, no embedding model, no WebLLM.
 *
 * Strategy:
 * 1. Direct code match (exact)
 * 2. Year level filter
 * 3. Keyword text search against chunk content
 */
export async function searchKnowledgeBase(
  userQuery: string,
  k = 5,
  onProgress?: (status: string) => void,
): Promise<SearchResult[]> {
  const { searchByCode, searchByYear, searchByText } = await import(
    "./database"
  );
  const queryTrimmed = userQuery.trim();

  console.log("Searching knowledge base with query:", queryTrimmed);

  // Direct code lookup
  if (CONTENT_CODE_RE.test(queryTrimmed)) {
    onProgress?.("Looking up code...");
    const row = await searchByCode(queryTrimmed);
    if (!row) return [];
    return [{ code: row.code, text: row.text, distance: 0, meta: row.meta }];
  }

  console.log("No direct code match, performing full search...");

  // Year-level filter
  const yearMatch = queryTrimmed.match(YEAR_RE);
  const hasYear = !!yearMatch;
  const year = hasYear ? Number(yearMatch![1]) : null;

  if (hasYear && year !== null) {
    console.log("Year filter detected:", year);
    onProgress?.(`Searching year ${year}...`);
    const rows = await searchByYear(year, k);
    return rows.map((r) => ({ ...r, distance: 0 }));
  }

  // Keyword text search
  onProgress?.("Searching curriculum...");
  console.log("Searching curriculum...");
  const results = await searchByText(queryTrimmed, k);
  console.log("Search results:", results);
  return results.map((r, i) => ({ ...r, distance: i / k }));
}
