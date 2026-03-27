export interface ChunkMetadata {
  yearLevel: string;
  strand: string;
  substrand: string;
  code: string;
  examples: string[];
  generalCapabilities?: string[];
}

export interface Chunk {
  code: string;
  text: string;
  metadata: ChunkMetadata;
}

export interface SearchResult extends Chunk {
  distance: number;
}
