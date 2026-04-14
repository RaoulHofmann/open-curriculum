export interface ChunkMetadata {
  year_level: number | null;
  strand: string | null;
  substrand: string | null;
  code: string;
  title?: string;
  examples: string[];
  capabilities: string[];
  image_url?: string;
}

export interface SearchFilters {
  yearLevel?: number | number[];
  strand?: string | string[];
  substrand?: string | string[];
  minSimilarity?: number;
}

export interface SearchResult {
  code: string;
  text: string;
  distance: number;
  meta: ChunkMetadata;
}
