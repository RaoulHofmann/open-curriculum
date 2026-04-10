export interface ChunkMetadata {
  yearLevel: number;
  strand: string;
  substrand: string;
  code: string;
  examples: string[];
  generalCapabilities?: string[];
}

export interface SearchResult {
  code: string;
  text: string;
  distance: number;
  meta: ChunkMetadata;
}

export interface RagSource {
  code?: string;
  text?: string;
  title?: string;
  distance?: number;
  meta?: ChunkMetadata;
}

export interface RagResult {
  answer: string;
  sources: RagSource[];
}

export interface AskRequest {
  question: string;
  answer: RagSource[];
}
