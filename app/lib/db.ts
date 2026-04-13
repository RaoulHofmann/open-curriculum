import sqlite3InitModule from "@sqlite.org/sqlite-wasm";
import type { EmbeddingModel } from "./models";

type SQLite3 = Awaited<ReturnType<typeof sqlite3InitModule>>;

let _sqlite3: SQLite3 | null = null;
let _db: any | null = null;
let _dbType: "opfs" | "memory" | null = null;
let _currentDbFile: string | null = null;

async function getSQLite3(): Promise<SQLite3> {
  if (_sqlite3) return _sqlite3;
  _sqlite3 = await sqlite3InitModule();
  return _sqlite3;
}

export async function getDatabase(dbFile: string): Promise<any> {
  if (_db && _currentDbFile === dbFile) return _db;

  _db?.close();
  _db = null;
  _dbType = null;

  const sqlite3 = await getSQLite3();
  const opfsAvailable = "opfs" in sqlite3;

  const opfsName = dbFile.replace(/^\//, "").replace(/\//g, "_");

  if (opfsAvailable) {
    if (_currentDbFile !== dbFile) {
      try {
        (sqlite3.oo1 as any).OpfsDb.prototype.close.call(
          new (sqlite3.oo1 as any).OpfsDb(opfsName, "r"),
        );
      } catch {
        const response = await fetch(dbFile);
        const bytes = new Uint8Array(await response.arrayBuffer());
        await (sqlite3.oo1 as any).OpfsDb.importDb(opfsName, bytes);
      }
    }

    _db = new (sqlite3.oo1 as any).OpfsDb(opfsName, "w");
    _dbType = "opfs";
  } else {
    const response = await fetch(dbFile);
    const bytes = new Uint8Array(await response.arrayBuffer());

    _db = new sqlite3.oo1.DB("/curriculum.sqlite", "ct");
    const p = sqlite3.wasm.allocFromTypedArray(bytes);
    try {
      const rc = sqlite3.capi.sqlite3_deserialize(
        _db.pointer!,
        "main",
        p,
        bytes.length,
        bytes.length,
        sqlite3.capi.SQLITE_DESERIALIZE_FREEONCLOSE,
      );
      _db.checkRc(rc);
    } catch (e) {
      sqlite3.wasm.dealloc(p);
      throw e;
    }
    _dbType = "memory";
  }

  _currentDbFile = dbFile;
  return _db;
}

export async function loadDatabase(model: EmbeddingModel): Promise<any> {
  return getDatabase(model.dbFile);
}

export function queryAll(
  db: any,
  sql: string,
  bind?: any[],
): Record<string, any>[] {
  const results: Record<string, any>[] = [];
  db.exec({
    sql,
    bind,
    rowMode: "object",
    callback: (row: Record<string, any>) => {
      results.push(row);
    },
  });
  return results;
}

export function queryOne(
  db: any,
  sql: string,
  bind?: any[],
): Record<string, any> | undefined {
  return queryAll(db, sql, bind)[0];
}
