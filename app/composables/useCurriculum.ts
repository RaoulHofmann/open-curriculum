import { ref } from "vue";
import type { SearchResult } from "~/types/search";
import { getEmbedding, expandQuery } from "~/lib/embeddings";
import { loadDatabase, queryOne } from "~/lib/db";
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

export function useCurriculum() {
  const results = ref<SearchResult[] | null>(null);
  const error = ref<Error | null>(null);
  const loading = ref(false);

  const search = async (query: string) => {
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

      const expandedQuery = expandQuery(queryTrimmed);
      const queryVector = await getEmbedding(expandedQuery);
      const topK = await searchEmbeddings(
        selectedModel.value,
        queryVector,
        20,
        hasYear && year ? { yearLevel: year } : undefined,
        queryTrimmed,
      );

      results.value = topK
        .slice(0, 5)
        .map((row) => ({
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
            image_url: buildImageUrl(row.image_data, row.image_type),
          },
        }));
    } catch (e) {
      error.value = e instanceof Error ? e : new Error(String(e));
    } finally {
      loading.value = false;
    }
  };

  return {
    search,
    results,
    error,
    loading,
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
