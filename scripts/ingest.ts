import { connect } from "@tursodatabase/database";
import { pipeline } from "@huggingface/transformers";
import { resolve } from "node:path";

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

const SOURCE_DB = "curriculum.sqlite";

async function ingest() {
  const targetModel = process.argv[2];

  const src = await connect(SOURCE_DB, { readonly: true });
  const rows = await src
    .prepare(
      `SELECT c.id, c.text, c.code, c.metadata
       FROM chunk_content c
       ORDER BY c.id`,
    )
    .all();

  console.log(`Read ${rows.length} items from source database`);
  await src.close();

  for (const model of MODELS) {
    if (targetModel && model.id !== targetModel) continue;

    console.log(`\nIngesting for ${model.id} (${model.dimension}d)...`);

    const srcEmbeddings = await connect(SOURCE_DB, { readonly: true });
    let embeddings: Float32Array[];

    if (model.dimension === 1024) {
      const vecRows = await srcEmbeddings
        .prepare(`SELECT embedding FROM vec_items ORDER BY rowid`)
        .all();

      embeddings = vecRows.map((r: any) => {
        const buf = r.embedding;
        if (buf instanceof Float32Array) return buf;
        return new Float32Array(buf.buffer ?? buf);
      });
      console.log(`  Migrated ${embeddings.length} existing embeddings`);
    } else {
      await srcEmbeddings.close();

      const pipe = await pipeline("feature-extraction", model.id);
      embeddings = [];

      const srcForEmbed = await connect(SOURCE_DB, { readonly: true });
      const textRows = await srcForEmbed
        .prepare(`SELECT text FROM chunk_content ORDER BY id`)
        .all();
      await srcForEmbed.close();

      for (let i = 0; i < textRows.length; i++) {
        const output = await pipe(textRows[i]!.text, {
          pooling: "mean",
          normalize: true,
        });
        embeddings.push(new Float32Array(output.data as Float32Array));
        if ((i + 1) % 10 === 0 || i === textRows.length - 1) {
          process.stdout.write(`\r  Embedded ${i + 1}/${textRows.length}`);
        }
      }
      console.log();

      // re-open src for the row data
      const srcRows = await connect(SOURCE_DB, { readonly: true });
      const _rows = await srcRows
        .prepare(
          `SELECT c.id, c.text, c.code, c.metadata
           FROM chunk_content c ORDER BY c.id`,
        )
        .all();
      await srcRows.close();
      // overwrite rows for this iteration
      rows.length = 0;
      rows.push(..._rows);
    }

    if (model.dimension === 1024) {
      await srcEmbeddings.close();
    }

    const db = await connect(model.outFile);
    await db.exec(`
      CREATE TABLE IF NOT EXISTS chunks (
        id INTEGER PRIMARY KEY,
        text TEXT,
        code TEXT,
        metadata TEXT,
        embedding BLOB
      )
    `);
    await db.exec("DELETE FROM chunks");

    const stmt = db.prepare(
      "INSERT INTO chunks (id, text, code, metadata, embedding) VALUES (?, ?, ?, ?, vector32(?))",
    );

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]!;
      const vecStr = JSON.stringify(Array.from(embeddings[i]!));
      await stmt.run(row.id, row.text, row.code, row.metadata, vecStr);
    }

    stmt.close();
    await db.close();

    console.log(`  Wrote ${resolve(model.outFile)}`);
  }

  console.log("\nDone");
}

ingest().catch(console.error);
