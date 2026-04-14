import type { EmbeddingModel } from "./models";

let _worker: Worker | null = null;
let _messageId = 0;
const _pending = new Map<number, { resolve: (v: any) => void; reject: (e: Error) => void }>();
let _initPromise: Promise<{ opfsAvailable: boolean }> | null = null;

function getWorker(): Worker {
  if (_worker) return _worker;
  _worker = new Worker(new URL("../workers/sqlite.worker.ts", import.meta.url), {
    type: "module",
  });
  _worker.onmessage = (event: MessageEvent) => {
    const { id, result, error } = event.data;
    const pending = _pending.get(id);
    if (pending) {
      _pending.delete(id);
      if (error) {
        pending.reject(new Error(error));
      } else {
        pending.resolve(result);
      }
    }
  };
  _worker.onerror = (event) => {
    console.error("SQLite worker error:", event);
  };
  return _worker;
}

function send<T = any>(type: string, payload?: any): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const worker = getWorker();
    const id = ++_messageId;
    _pending.set(id, { resolve, reject });
    worker.postMessage({ type, id, payload });
  });
}

async function ensureInitialized(): Promise<{ opfsAvailable: boolean }> {
  if (_initPromise) return _initPromise;

  const config = useRuntimeConfig();
  const appBaseURL: string = config.app.baseURL;

  _initPromise = send("init", { appBaseURL });
  return _initPromise;
}

export async function loadDatabase(model: EmbeddingModel): Promise<void> {
  await ensureInitialized();

  const openResult = await send<{ persistent: boolean; needsImport: boolean; alreadyOpen?: boolean }>(
    "open",
    { dbFile: model.dbFile },
  );

  if (openResult.alreadyOpen) return;

  if (openResult.needsImport) {
    const config = useRuntimeConfig();
    const appBaseURL: string = config.app.baseURL;
    const response = await fetch(`${appBaseURL}${model.dbFile}`);
    const bytes = new Uint8Array(await response.arrayBuffer());
    await send("import", { dbFile: model.dbFile, bytes });
  }
}

export async function queryAll(
  sql: string,
  bind?: any[],
): Promise<Record<string, any>[]> {
  await ensureInitialized();
  return send<Record<string, any>[]>("exec", { sql, bind, rowMode: "object" });
}

export async function queryOne(
  sql: string,
  bind?: any[],
): Promise<Record<string, any> | undefined> {
  const rows = await queryAll(sql, bind);
  return rows[0];
}

export async function clearOPFS(): Promise<void> {
  await ensureInitialized();
  await send("clear");
  // Reset init so next loadDatabase re-initializes
  _initPromise = null;
}
