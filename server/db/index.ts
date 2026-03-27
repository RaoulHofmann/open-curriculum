import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as sqliteVec from "sqlite-vec";

const sqlite = new Database(process.env.DB_FILE_NAME || "curriculum.sqlite");
sqliteVec.load(sqlite);

export const db = drizzle(sqlite);
export { sqlite };

db.run(
  "CREATE VIRTUAL TABLE IF NOT EXISTS vec_items USING vec0(embedding float[768])",
);
db.run(
  "CREATE TABLE IF NOT EXISTS chunk_content (id INTEGER PRIMARY KEY, text TEXT, code TEXT, metadata TEXT)",
);
