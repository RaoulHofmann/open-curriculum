# Open Curriculum

A browser-based semantic search tool for curriculum content. Runs entirely client-side using SQLite WASM, OPFS-backed persistent storage, and transformer-based embeddings.

## Architecture

```
app/
├── lib/
│   ├── db.ts           # SQLite WASM database layer with OPFS persistence
│   ├── search.ts       # Cosine-distance vector search over embeddings
│   ├── embeddings.ts   # Query expansion helpers
│   └── models.ts       # Embedding model registry and Hugging Face pipeline
├── composables/
│   └── useCurriculum.ts # Vue composable wiring search, DB, and model loading
├── components/
│   └── ModelSelector.vue
└── pages/
    └── index.vue
scripts/
└── ingest.ts           # Node.js script to generate embedding databases
```

## Implementation Breakdown

### SQLite WASM (`app/lib/db.ts`)

The database layer uses `@sqlite.org/sqlite-wasm`, the official SQLite WebAssembly build.

**Initialization** — `sqlite3InitModule()` loads the WASM binary once. The module instance is cached and reused across all database operations.

**OPFS persistence** — When the browser supports Origin Private File System (OPFS), databases are opened using `OpfsDatabase`, which persists across page reloads and sessions. On first load, the `.sqlite` file is fetched from the server and imported into OPFS via `OpfsDb.importDb()`. Subsequent loads open directly from OPFS, skipping the network fetch entirely.

**Memory fallback** — When OPFS is unavailable (e.g. missing COOP/COEP headers, older browsers), an in-memory database is created and populated using `sqlite3_deserialize()` from the fetched bytes. Data must be re-fetched on each page load in this mode.

**Query helpers** — `queryAll()` and `queryOne()` wrap SQLite WASM's `db.exec()` callback API into a simpler interface returning arrays of plain row objects, similar to what Turso/libsql's `.prepare().all()` provided.

### OPFS Requirements

OPFS requires two HTTP headers for `SharedArrayBuffer` support:

```
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: require-corp
```

These are configured in `nuxt.config.ts` for both Vite dev server and Nitro (production). Without these headers, the app falls back to in-memory databases.

### Vector Search (`app/lib/search.ts`)

Embeddings are stored as raw `BLOB` values (Float32 byte arrays) in the `chunks` table:

```sql
CREATE TABLE chunks (
  id INTEGER PRIMARY KEY,
  text TEXT,
  code TEXT,
  metadata TEXT,
  embedding BLOB
)
```

Since vanilla SQLite WASM doesn't include vector extension functions (`vector_distance_cos`, `vector32`), cosine distance is computed in JavaScript:

1. All rows with embeddings are fetched from the database
2. Each `BLOB` is reinterpreted as a `Float32Array` (zero-copy `ArrayBuffer` view)
3. Cosine distance is computed against the query vector
4. Results are sorted by distance and the top-k are returned

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
