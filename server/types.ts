import { t } from "elysia";

// ─── Metadata ────────────────────────────────────────────────────────────────

export const chunkMetadataSchema = t.Object({
  yearLevel: t.String(),
  strand: t.String(),
  substrand: t.String(),
  code: t.String(),
  title: t.Optional(t.String()),
  examples: t.Array(t.String()),
  generalCapabilities: t.Optional(t.Array(t.String())),
});

export type ChunkMetadata = typeof chunkMetadataSchema.static;

// ─── Chunk (raw, no distance) ─────────────────────────────────────────────────

export const chunkSchema = t.Object({
  code: t.String(),
  text: t.String(),
  metadata: chunkMetadataSchema,
});

export type Chunk = typeof chunkSchema.static;

// ─── Search result (chunk + distance, returned by searchKnowledgeBase) ────────

export const searchResultSchema = t.Object({
  code: t.String(),
  text: t.String(),
  distance: t.Number(),
  meta: chunkMetadataSchema,
});

export type SearchResult = typeof searchResultSchema.static;

// ─── RAG source (search result with optional fields, returned in RAG answer) ──

export const ragSourceSchema = t.Object({
  code: t.Optional(t.String()),
  text: t.Optional(t.String()),
  title: t.Optional(t.String()),
  distance: t.Optional(t.Number()),
  meta: t.Optional(chunkMetadataSchema),
});

export type RagSource = typeof ragSourceSchema.static;

// ─── RAG result (full answer from answerWithRAG) ──────────────────────────────

export const ragResultSchema = t.Object({
  answer: t.String(),
  sources: t.Array(ragSourceSchema),
  raw: t.Optional(t.Any()),
});

export type RagResult = typeof ragResultSchema.static;

// ─── HTTP request / response shapes ──────────────────────────────────────────

export const askRequestSchema = t.Object({
  question: t.String(),
  answer: t.Array(ragSourceSchema),
});

export type AskRequest = typeof askRequestSchema.static;

export const askResponseSchema = t.Object({
  question: t.String(),
  answer: t.String(),
  sources: t.Array(ragSourceSchema),
  raw: t.Optional(t.Any()),
});

export type AskResponse = typeof askResponseSchema.static;
