# Open Curriculum

A browser-based semantic search tool for curriculum content. Runs entirely client-side using SQLite WASM, OPFS-backed persistent storage, and transformer-based embeddings.

## Architecture

```
app/
├── lib/
│   ├── db.ts           # SQLite WASM database layer (communicates via Web Worker)
│   ├── search.ts       # Hybrid vector + text-match search over embeddings
│   ├── embeddings.ts   # Query expansion helpers
│   └── models.ts       # Embedding model registry and Hugging Face pipeline
├── composables/
│   └── useCurriculum.ts # Vue composable wiring search, DB, and model loading
├── components/
│   └── ModelSelector.vue
├── workers/
│   └── sqlite.worker.ts # Web Worker running SQLite WASM with OPFS persistence
└── pages/
    └── index.vue
scripts/
└── ingest.ts           # Node.js script to generate embedding databases
```

## Implementation Breakdown

### SQLite WASM (`app/lib/db.ts`, `app/workers/sqlite.worker.ts`)

The database layer uses `@sqlite.org/sqlite-wasm` running inside a Web Worker to avoid blocking the main thread. All SQLite operations are offloaded to the worker via message passing.

**Worker architecture** — `app/lib/db.ts` spawns a dedicated Web Worker (`sqlite.worker.ts`) on first use. Communication uses a request/response pattern with auto-incrementing message IDs. Each call to `queryAll()` or `queryOne()` posts a message to the worker and returns a promise that resolves when the worker responds.

**Initialization** — The worker calls `sqlite3InitModule()` to load the WASM binary once. The module instance is cached and reused across all database operations.

**OPFS persistence** — When the browser supports Origin Private File System (OPFS), databases are opened using `OpfsDatabase`, which persists across page reloads and sessions. On first load, the `.sqlite` file is fetched from the server and imported into OPFS via `OpfsDb.importDb()`. Subsequent loads open directly from OPFS, skipping the network fetch entirely.

**Memory fallback** — When OPFS is unavailable (e.g. missing COOP/COEP headers, older browsers), an in-memory database is created and populated using `sqlite3_deserialize()` from the fetched bytes. Data must be re-fetched on each page load in this mode.

**Query helpers** — `queryAll()` and `queryOne()` in `db.ts` wrap the worker message-passing into a simple async interface returning arrays of plain row objects. The worker's `handleExec()` function runs `db.exec()` with the callback row mode.

### OPFS Requirements

OPFS requires two HTTP headers for `SharedArrayBuffer` support:

```
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: require-corp
```

These are configured in `nuxt.config.ts` for both Vite dev server and Nitro (production). Without these headers, the app falls back to in-memory databases.

### Vector Search (`app/lib/search.ts`)

Search uses a hybrid approach combining semantic embedding similarity with lexical text matching.

**Database schema** — Curriculum items and their embeddings are stored in two tables:

```sql
CREATE TABLE curriculum_items (
  id INTEGER PRIMARY KEY,
  code TEXT NOT NULL,
  text TEXT NOT NULL,
  year_level INTEGER,
  strand TEXT,
  substrand TEXT,
  examples TEXT,
  capabilities TEXT,
  image_data BLOB,
  image_type TEXT
);

CREATE TABLE embeddings (
  id INTEGER PRIMARY KEY,
  curriculum_id INTEGER NOT NULL,
  embedding BLOB NOT NULL,
  FOREIGN KEY (curriculum_id) REFERENCES curriculum_items(id)
);
```

Embeddings are stored as raw `BLOB` values (Float32 byte arrays).

**Search flow:**

1. All rows with embeddings are fetched from the database
2. Each `BLOB` is reinterpreted as a `Float32Array` (zero-copy `ArrayBuffer` view)
3. Cosine distance is computed against the query vector
4. A text-match score (0–1) is computed: exact phrase match → 1.0, partial word matches → proportional score
5. The embedding distance is blended with the text-match score: `distance = distance * (1 - 0.3 * textMatchScore)`
6. Results are sorted by blended distance and the top-k are returned

This hybrid scoring ensures that results containing the exact search terms rank higher than semantically similar but textually distant results.

### Embedding Models (`app/lib/models.ts`)

Two pre-built models are supported:

| Model | Dimensions | Database | Use Case |
|-------|-----------|----------|----------|
| `Xenova/all-MiniLM-L6-v2` | 384 | `curriculum-384.sqlite` | Fast, lightweight searches |
| `mixedbread-ai/mxbai-embed-large-v1` | 1024 | `curriculum-1024.sqlite` | Higher accuracy semantic search |

Models run client-side via `@huggingface/transformers` using the `feature-extraction` pipeline with mean pooling and L2 normalization.

### Database Ingestion (`scripts/ingest.ts`)

The ingest script runs in Node.js using `@tursodatabase/database` (separate from the browser WASM package). It:

1. Reads curriculum chunks from a source `curriculum.sqlite` database
2. Generates embeddings using Hugging Face transformers (or migrates existing ones for 1024-dim)
3. Writes model-specific `.sqlite` files with chunks and embedding BLOBs into `public/`

## Setup

```bash
npm install
```

## Development

```bash
npm run dev
```

The dev server runs at `http://localhost:3000/open-curriculum/`.

## Build

```bash
npm run build
npm run preview
```

## Regenerating Embeddings

```bash
# All models
npx tsx scripts/ingest.ts

# Specific model
npx tsx scripts/ingest.ts "Xenova/all-MiniLM-L6-v2"
```

Requires a source `curriculum.sqlite` database in the project root with `chunk_content` and optionally `vec_items` tables.
