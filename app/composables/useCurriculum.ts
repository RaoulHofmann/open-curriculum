import { ref } from "vue";
import { searchKnowledgeBase } from "~/services/search";
import { buildContextFromResults, buildPrompt } from "~/services/rag";
import type { RagSource } from "~/types";

export function useCurriculum() {
  const result = ref<{ question: string; answer: RagSource[] } | null>(null);
  const ragAnswer = ref<string | null>(null);
  const error = ref<Record<string, any> | null>(null);
  const loading = ref(false);
  const generating = ref(false);
  const initStatus = ref<string>("");

  const { initEngine, generate, state: llmState } = useWebLLM();

  async function search(query: string) {
    loading.value = true;
    error.value = null;
    result.value = null;
    initStatus.value = "";

    try {
      initStatus.value = "Loading database...";
      const results = await searchKnowledgeBase(query, 5, (status) => {
        initStatus.value = status;
      });

      result.value = {
        question: query,
        answer: results,
      };
    } catch (e: any) {
      error.alue = { message: e?.message ?? "Search failed" };
    } finally {
      loading.value = false;
      initStatus.value = "";
    }
  }

  async function ask(query: string) {
    loading.value = true;
    generating.value = false;
    error.value = null;
    result.value = null;
    ragAnswer.value = null;
    initStatus.value = "";

    try {
      // Phase 1: Search (Turso DB only, no LLM)
      initStatus.value = "Searching curriculum...";
      const results = await searchKnowledgeBase(query, 5, (status) => {
        initStatus.value = status;
      });

      result.value = {
        question: query,
        answer: results,
      };

      // Phase 2: Load WebLLM and generate
      initStatus.value = "Loading WebLLM model...";
      await initEngine();

      generating.value = true;
      initStatus.value = "";

      const context = buildContextFromResults(results);
      const prompt = buildPrompt({ question: query, context });
      const answer = await generate(prompt);
      ragAnswer.value = answer;
    } catch (e: any) {
      error.value = { message: e?.message ?? "Failed to generate answer" };
    } finally {
      loading.value = false;
      generating.value = false;
      initStatus.value = "";
    }
  }

  return {
    ask,
    search,
    result,
    ragAnswer,
    error,
    loading,
    generating,
    llmState,
    initStatus,
  };
}
