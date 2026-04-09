import { ref } from "vue";
import type { AskRequest } from "~~/server/types";

export function useCurriculum() {
  const { $api } = useNuxtApp();

  const result = ref<AskRequest | null>(null);
  const error = ref<null | Record<string, any>>(null);
  const loading = ref(false);

  const ask = async (query: string) => {
    loading.value = true;
    error.value = null;
    result.value = null;

    try {
      const response = await $api.curriculum.ask.get({
        query: { q: query },
      });

      if (response.error) {
        error.value = response.error;
      } else {
        result.value = response.data;
      }
    } catch (e) {
      console.error(e);
    } finally {
      loading.value = false;
    }
  };

  return { ask, result, error, loading };
}
