import sqlite3InitModule from "@sqlite.org/sqlite-wasm";

type SQLite3 = Awaited<ReturnType<typeof sqlite3InitModule>>;

let sqlite3: SQLite3 | null = null;
let db: any = null;
let _currentDbFile: string | null = null;
let appBaseURL = "/";

interface WorkerMessage {
  type: string;
  id: number;
  payload?: any;
}

interface WorkerResponse {
  id: number;
  result?: any;
  error?: string;
}

function respond(msg: WorkerResponse) {
  self.postMessage(msg);
}

async function handleInit(payload: { appBaseURL: string }) {
  appBaseURL = payload.appBaseURL;
  sqlite3 = await sqlite3InitModule();
  const opfsAvailable = sqlite3 !== null && "opfs" in sqlite3;
  return { opfsAvailable };
}

async function handleOpen(payload: { dbFile: string }) {
  if (!sqlite3) throw new Error("SQLite not initialized");

  const { dbFile } = payload;

  if (db && _currentDbFile === dbFile) {
    return { persistent: true, alreadyOpen: true };
  }

  db?.close();
  db = null;
  _currentDbFile = null;

  const opfsAvailable = "opfs" in sqlite3;
  const opfsName = dbFile.replace(/^\//, "").replace(/\//g, "_");

  if (opfsAvailable) {
    // Check if database already exists in OPFS
    let exists = false;
    try {
      const testDb = new (sqlite3.oo1 as any).OpfsDb(opfsName, "r");
      testDb.close();
      exists = true;
    } catch {
      exists = false;
    }

    if (exists) {
      db = new (sqlite3.oo1 as any).OpfsDb(opfsName, "w");
      _currentDbFile = dbFile;
      return { persistent: true, needsImport: false };
    }

    return { persistent: true, needsImport: true };
  }

  return { persistent: false, needsImport: true };
}

async function handleImport(payload: { dbFile: string; bytes: Uint8Array }) {
  if (!sqlite3) throw new Error("SQLite not initialized");

  const { dbFile, bytes } = payload;
  const opfsAvailable = "opfs" in sqlite3;
  const opfsName = dbFile.replace(/^\//, "").replace(/\//g, "_");

  db?.close();
  db = null;

  if (opfsAvailable) {
    await (sqlite3.oo1 as any).OpfsDb.importDb(opfsName, bytes);
    db = new (sqlite3.oo1 as any).OpfsDb(opfsName, "w");
  } else {
    db = new sqlite3.oo1.DB(":memory:");
    const p = sqlite3.wasm.allocFromTypedArray(bytes);
    try {
      const rc = sqlite3.capi.sqlite3_deserialize(
        db.pointer!,
        "main",
        p,
        bytes.length,
        bytes.length,
        sqlite3.capi.SQLITE_DESERIALIZE_FREEONCLOSE,
      );
      db.checkRc(rc);
    } catch (e) {
      sqlite3.wasm.dealloc(p);
      throw e;
    }
  }

  _currentDbFile = dbFile;
  return { success: true };
}

function handleExec(payload: {
  sql: string;
  bind?: any[];
  rowMode?: "array" | "object";
}) {
  if (!db) throw new Error("Database not open");

  const { sql, bind, rowMode } = payload;
  const results: Record<string, any>[] = [];

  db.exec({
    sql,
    bind,
    rowMode: rowMode ?? "object",
    callback: (row: Record<string, any>) => {
      results.push(row);
    },
  });

  return results;
}

function handleClose() {
  db?.close();
  db = null;
  _currentDbFile = null;
  return { success: true };
}

async function handleClear() {
  db?.close();
  db = null;
  _currentDbFile = null;

  try {
    const root = await navigator.storage.getDirectory();
    // @ts-ignore — entries() is async iterable in OPFS
    for await (const [name] of root.entries()) {
      await root.removeEntry(name, { recursive: true });
    }
  } catch (e) {
    throw new Error(`Failed to clear OPFS: ${e}`);
  }

  return { success: true };
}

self.onmessage = async (event: MessageEvent<WorkerMessage>) => {
  const { type, id, payload } = event.data;

  try {
    let result: any;

    switch (type) {
      case "init":
        result = await handleInit(payload);
        break;
      case "open":
        result = await handleOpen(payload);
        break;
      case "import":
        result = await handleImport(payload);
        break;
      case "exec":
        result = handleExec(payload);
        break;
      case "close":
        result = handleClose();
        break;
      case "clear":
        result = await handleClear();
        break;
      default:
        throw new Error(`Unknown message type: ${type}`);
    }

    respond({ id, result });
  } catch (e) {
    respond({
      id,
      error: e instanceof Error ? e.message : String(e),
    });
  }
};
