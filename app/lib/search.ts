import { getDatabase, queryAll } from "./db";
import type { EmbeddingModel } from "./models";

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

export async function searchEmbeddings(
  model: EmbeddingModel,
  queryVector: Float32Array,
  k: number,
): Promise<Array<{ id: number; text: string; code: string; metadata: string; distance: number }>> {
  const db = await getDatabase(model.dbFile);

  const rows = queryAll(
    db,
    "SELECT id, text, code, metadata, embedding FROM chunks",
  );

  const results = rows.map((row) => {
    const embedding = new Float32Array(
      (row.embedding as Uint8Array).buffer,
      (row.embedding as Uint8Array).byteOffset,
      (row.embedding as Uint8Array).byteLength / 4,
    );
    return {
      id: row.id as number,
      text: row.text as string,
      code: row.code as string,
      metadata: row.metadata as string,
      distance: cosineDistance(queryVector, embedding),
    };
  });

  results.sort((a, b) => a.distance - b.distance);
  return results.slice(0, k);
}
