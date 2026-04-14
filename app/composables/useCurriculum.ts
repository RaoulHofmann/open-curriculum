import { ref } from "vue";
import type { SearchResult, SearchFilters } from "~/types/search";
import { getEmbedding, expandQuery } from "~/lib/embeddings";
import { loadDatabase, queryOne, queryAll } from "~/lib/db";
import { searchEmbeddings } from "~/lib/search";
import {
  selectedModel,
  isModelReady,
  isDownloading,
  downloadProgress,
  downloadStatus,
  showModelSelector,
  checkOnLoad,
  loadModel,
  selectModel,
  MODELS,
} from "~/lib/models";

const CONTENT_CODE_RE = /^WA\d[A-Z0-9]+$/;
const YEAR_RE = /(?:year\s+)(\d+)|(\d+)(?:\s+year)/i;

function uint8ToBase64(data: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < data.length; i++) {
    binary += String.fromCharCode(data[i]!);
  }
  return btoa(binary);
}

function buildImageUrl(
  imageData: Uint8Array | null,
  imageType: string | null,
): string | undefined {
  if (!imageData || !imageType) return undefined;
  return `data:${imageType};base64,${uint8ToBase64(imageData)}`;
}

function buildMeta(row: Record<string, any>): SearchResult["meta"] {
  return {
    year_level: row.year_level as number | null,
    strand: row.strand as string | null,
    substrand: row.substrand as string | null,
    code: row.code as string,
    examples: JSON.parse((row.examples as string) ?? "[]"),
    capabilities: JSON.parse((row.capabilities as string) ?? "[]"),
    image_url: buildImageUrl(
      row.image_data as Uint8Array | null,
      row.image_type as string | null,
    ),
  };
}

export interface FilterOptions {
  yearLevels: number[];
  strands: string[];
  substrandsByStrand: Record<string, string[]>;
}

export function useCurriculum() {
  const results = ref<SearchResult[] | null>(null);
  const error = ref<Error | null>(null);
  const loading = ref(false);
  const filterOptions = ref<FilterOptions | null>(null);

  const search = async (query: string, filters?: SearchFilters) => {
    if (!isModelReady.value) {
      error.value = new Error("Model is not loaded yet. Please select and download a model first.");
      return;
    }

    loading.value = true;
    error.value = null;
    results.value = null;

    try {
      const queryTrimmed = query.trim();

      if (CONTENT_CODE_RE.test(queryTrimmed)) {
        await loadDatabase(selectedModel.value);
        const row = await queryOne(
          "SELECT code, text, year_level, strand, substrand, examples, capabilities, image_data, image_type FROM curriculum_items WHERE code = ?",
          [queryTrimmed],
        );

        if (!row) {
          results.value = [];
          return;
        }

        results.value = [
          {
            code: row.code as string,
            text: row.text as string,
            distance: 0,
            meta: buildMeta(row),
          },
        ];
        return;
      }

      const match = queryTrimmed.match(YEAR_RE);
      const hasYear = !!match;
      const year = hasYear && match![1] ? parseInt(match![1], 10) : null;

      const searchFilters: SearchFilters = {
        ...filters,
        ...(hasYear && year ? { yearLevel: year } : {}),
      };

      const expandedQuery = expandQuery(queryTrimmed);
      const queryVector = await getEmbedding(expandedQuery);
      const topK = await searchEmbeddings(
        selectedModel.value,
        queryVector,
        20,
        Object.keys(searchFilters).length > 0 ? searchFilters : undefined,
        queryTrimmed,
      );

      let imageMap = new Map<number, { data: Uint8Array; type: string }>();
      if (topK.length > 0) {
        const ids = topK.map((r) => r.id);
        const placeholders = ids.map(() => "?").join(",");
        const imageRows = await queryAll(
          `SELECT id, image_data, image_type FROM curriculum_items WHERE id IN (${placeholders})`,
          ids,
        );
        for (const row of imageRows) {
          if (row.image_data && row.image_type) {
            imageMap.set(row.id as number, {
              data: row.image_data as Uint8Array,
              type: row.image_type as string,
            });
          }
        }
      }

      results.value = topK.map((row) => {
        const img = imageMap.get(row.id);
        return {
          code: row.code,
          text: row.text,
          distance: row.distance,
          meta: {
            year_level: row.year_level,
            strand: row.strand,
            substrand: row.substrand,
            code: row.code,
            examples: JSON.parse(row.examples ?? "[]"),
            capabilities: JSON.parse(row.capabilities ?? "[]"),
            image_url: img ? buildImageUrl(img.data, img.type) : undefined,
          },
        };
      });
    } catch (e) {
      error.value = e instanceof Error ? e : new Error(String(e));
    } finally {
      loading.value = false;
    }
  };

  const fetchFilterOptions = async (): Promise<FilterOptions> => {
    if (filterOptions.value) return filterOptions.value;

    await loadDatabase(selectedModel.value);

    const [yearRows, strandRows, substrandRows] = await Promise.all([
      queryAll("SELECT DISTINCT year_level FROM curriculum_items WHERE year_level IS NOT NULL ORDER BY year_level"),
      queryAll("SELECT DISTINCT strand FROM curriculum_items WHERE strand IS NOT NULL ORDER BY strand"),
      queryAll("SELECT DISTINCT strand, substrand FROM curriculum_items WHERE strand IS NOT NULL AND substrand IS NOT NULL ORDER BY strand, substrand"),
    ]);

    const yearLevels = yearRows.map((r) => r.year_level as number);
    const strands = strandRows.map((r) => r.strand as string);

    const substrandsByStrand: Record<string, string[]> = {};
    for (const row of substrandRows) {
      const strand = row.strand as string;
      const substrand = row.substrand as string;
      if (!substrandsByStrand[strand]) {
        substrandsByStrand[strand] = [];
      }
      substrandsByStrand[strand].push(substrand);
    }

    filterOptions.value = { yearLevels, strands, substrandsByStrand };
    return filterOptions.value;
  };

  return {
    search,
    results,
    error,
    loading,
    filterOptions,
    fetchFilterOptions,
    selectedModel,
    checkOnLoad,
    isModelReady,
    isDownloading,
    downloadProgress,
    downloadStatus,
    showModelSelector,
    loadModel,
    selectModel,
    models: MODELS,
  };
}
