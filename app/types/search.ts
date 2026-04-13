export interface ChunkMetadata {
  yearLevel: string;
  strand: string;
  substrand: string;
  code: string;
  title?: string;
  examples: string[];
  generalCapabilities?: string[];
}

export interface SearchResult {
  code: string;
  text: string;
  distance: number;
  meta: ChunkMetadata;
}
