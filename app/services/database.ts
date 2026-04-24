import { connect } from '@tursodatabase/database-wasm/vite';

let _db: any = null;

export async function getDatabase() {
  if (_db) return _db;

  console.log("Connecting to database");

  try {
    console.log("Attempting to connect to: public/curriculum.db");
    _db = await connect("public/curriculum.db");
    console.log("Connection object:", _db);

    // Check if _db has the expected methods
    console.log("DB methods:", Object.keys(_db));

    const result = _db.exec("SELECT * from chunks LIMIT 10;");
    console.log("Query result:", result);

    return _db;
  } catch (e) {
    console.error("Database connection error:", e);
    console.error("Error details:", JSON.stringify(e, null, 2));
    throw e;
  }
}

export async function searchByCode(code: string) {
  const db = await getDatabase();
  const rows = await db
      .prepare("SELECT text, code, metadata FROM chunks WHERE code = ?")
      .all(code);

  if (rows.length === 0) return null;
  const row = rows[0];
  return {
    code: row.code as string,
    text: row.text as string,
    meta: JSON.parse(row.metadata as string),
  };
}

export async function searchByYear(year: number, limit = 50) {
  const db = await getDatabase();
  const rows = await db
      .prepare(
          "SELECT text, code, metadata FROM chunks WHERE json_extract(metadata, '$.yearLevel') = ? LIMIT ?",
      )
      .all(year, limit);

  return rows.map((row: any) => ({
    code: row.code as string,
    text: row.text as string,
    meta: JSON.parse(row.metadata as string),
  }));
}

export async function searchByText(query: string, limit = 5) {
  const db = await getDatabase();
  console.log("Searching by text:", query);
  const keywords = query
      .toLowerCase()
      .split(/\s+/)
      .filter((w) => w.length > 2);

  console.log("Keywords:", keywords);

  if (keywords.length === 0) {
    // Fallback: search the full query
    const rows = await db
        .prepare("SELECT text, code, metadata FROM chunks WHERE LOWER(text) LIKE ? LIMIT ?")
        .all(`%${query.toLowerCase()}%`, limit);
    return rows.map(mapRow);
  }

  // Build a query that matches more keywords = higher rank
  const conditions = keywords.map(() => "LOWER(text) LIKE ?");
  const sql = `
    SELECT text, code, metadata,
           (${conditions.map((c) => `CASE WHEN ${c} THEN 1 ELSE 0 END`).join(" + ")}) AS relevance
    FROM chunks
    WHERE ${conditions.join(" OR ")}
    ORDER BY relevance DESC
      LIMIT ?
  `;
  const args = [
    ...keywords.map((k) => `%${k}%`),
    ...keywords.map((k) => `%${k}%`),
    limit,
  ];

  const rows = await db.prepare(sql).all(...args);
  return rows.map(mapRow);
}

function mapRow(row: any) {
  return {
    code: row.code as string,
    text: row.text as string,
    meta: JSON.parse(row.metadata as string),
  };
}

export async function getAllChunks() {
  const db = await getDatabase();
  const rows = await db
      .prepare("SELECT id, text, code, metadata, embedding FROM chunks")
      .all();

  return rows.map((row: any) => ({
    id: row.id as number,
    code: row.code as string,
    text: row.text as string,
    meta: JSON.parse(row.metadata as string),
    embedding: new Float32Array(
        (row.embedding as ArrayBuffer).buffer ?? new ArrayBuffer(0),
    ),
  }));
}

export async function getMetadata() {
  const db = await getDatabase();
  const rows = await db
      .prepare(
          `
            SELECT
              json_extract(metadata, '$.yearLevel') AS year_level,
              json_extract(metadata, '$.strand')    AS strand,
              json_group_array(json_extract(metadata, '$.code')) AS codes
            FROM chunks
            GROUP BY
              json_extract(metadata, '$.yearLevel'),
              json_extract(metadata, '$.strand')
            ORDER BY
              year_level,
              strand
          `,
      )
      .all();

  return rows.map((m: any) => ({
    year_level: m.year_level,
    strand: m.strand,
    codes: JSON.parse(m.codes as string),
  }));
}