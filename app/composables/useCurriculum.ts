import { ref } from "vue";
import type { SearchResult } from "~/types/search";
import { getEmbedding, expandQuery } from "~/lib/embeddings";
import { getDatabase, queryOne } from "~/lib/db";
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
        const db = await getDatabase(selectedModel.value.dbFile);
        const row = queryOne(
          db,
          "SELECT text, code, metadata FROM chunks WHERE code = ?",
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
            meta: JSON.parse(row.metadata as string),
          },
        ];
        return;
      }

      const match = queryTrimmed.match(YEAR_RE);
      const hasYear = !!match;
      const year = hasYear ? match![1] : null;

      const expandedQuery = expandQuery(queryTrimmed);
      const queryVector = await getEmbedding(expandedQuery);
      const topK = await searchEmbeddings(selectedModel.value, queryVector, 20);
      const distanceMap = new Map(topK.map((r) => [r.id, r.distance]));

      console.log(distanceMap)

      results.value = topK
        .map((row) => ({
          code: row.code,
          text: row.text,
          distance: row.distance,
          meta: JSON.parse(row.metadata),
        }))
        .filter((row) => {
          if (!hasYear) return true;
          return row.meta.yearLevel === year;
        })
        .sort((a, b) => a.distance - b.distance)
        .slice(0, 5);
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
