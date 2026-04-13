<script setup lang="ts">
import type { SearchResult } from "~/types/search";
const {
  search,
  results,
  error,
  loading,
  selectedModel,
  isModelReady,
  isDownloading,
  downloadProgress,
  downloadStatus,
  showModelSelector,
  loadModel,
  selectModel,
  checkOnLoad,
  models,
} = useCurriculum();

const query = ref("fractions");
const hasSearched = ref(false);

async function handleSearch() {
  if (!query.value.trim()) return;
  hasSearched.value = true;
  await search(query.value.trim());
}

async function handleModelLoad() {
  try {
    await loadModel();
  } catch {
  }
}

function openModelSelector() {
  showModelSelector.value = true;
}

function handleCloseModelSelector() {
  showModelSelector.value = false;
}

onMounted(() => {
  if (isModelReady.value) {
    handleSearch();
  }

  checkOnLoad()
});

const badge = (distance?: number) => {
  if (distance === undefined)
    return { color: "neutral" as const, label: "—" };
  if (distance < 0.4)
    return { color: "success" as const, label: "High match" };
  if (distance < 0.7) return { color: "warning" as const, label: "Partial" };
  return { color: "error" as const, label: "Low match" };
};
</script>

<template>
  <div class="min-h-screen bg-[var(--ui-bg)]">
    <ModelSelector
      v-if="showModelSelector"
      :open="showModelSelector"
      :models="models"
      :selected-model="selectedModel"
      :is-model-ready="isModelReady"
      :is-downloading="isDownloading"
      :download-progress="downloadProgress"
      :download-status="downloadStatus"
      @select="selectModel"
      @closeModal="handleCloseModelSelector"
      @load="handleModelLoad"
    />

    <div class="max-w-3xl mx-auto px-4 py-12">
      <div class="mb-10">
        <p
          class="text-xs font-semibold tracking-widest uppercase text-[var(--ui-text-muted)] mb-2"
        >
          Curriculum Explorer
        </p>
        <h1
          class="text-3xl font-bold text-[var(--ui-text-highlighted)] mb-1"
        >
          Search the curriculum
        </h1>
        <p class="text-sm text-[var(--ui-text-muted)]">
          Find curriculum content by keyword or topic.
        </p>
      </div>

      <div class="flex items-center gap-2 mb-4">
        <UBadge
          variant="soft"
          color="neutral"
          size="sm"
          class="cursor-pointer"
          @click="openModelSelector"
        >
          <UIcon name="i-heroicons-cube" class="w-3 h-3 mr-1" />
          {{ selectedModel.name }}
          <span v-if="!isModelReady && !isDownloading"> · not loaded</span>
          <span v-else-if="isDownloading"> · loading…</span>
          <UIcon name="i-heroicons-chevron-down" class="w-3 h-3 ml-1" />
        </UBadge>
      </div>

      <div class="flex gap-2 mb-10">
        <UInput
          v-model="query"
          placeholder="e.g. fractions, place value, geometry…"
          size="lg"
          class="flex-1"
          :disabled="loading || !isModelReady"
          @keydown.enter="handleSearch"
        >
          <template #leading>
            <UIcon
              name="i-heroicons-magnifying-glass"
              class="text-[var(--ui-text-muted)]"
            />
          </template>
        </UInput>
        <UButton
          size="lg"
          :loading="loading"
          :disabled="!query.trim() || !isModelReady"
          @click="handleSearch"
        >
          Search
        </UButton>
      </div>

      <div
        v-if="!isModelReady && !isDownloading"
        class="flex flex-col items-center justify-center py-12 text-center"
      >
        <UIcon
          name="i-heroicons-arrow-down-tray"
          class="w-10 h-10 text-[var(--ui-text-dimmed)] mb-3"
        />
        <p class="text-sm text-[var(--ui-text-muted)] mb-3">
          Download a model to start searching.
        </p>
        <UButton
          size="sm"
          variant="soft"
          @click="openModelSelector"
        >
          Select Model
        </UButton>
      </div>

      <div v-else-if="loading" class="space-y-3">
        <USkeleton
          class="h-28 w-full rounded-xl"
          v-for="n in 4"
          :key="n"
        />
      </div>

      <UAlert
        v-else-if="error"
        icon="i-heroicons-exclamation-triangle"
        color="error"
        variant="soft"
        :description="error?.message"
        title="Something went wrong"
        class="mb-6"
      />

      <template v-else-if="results && hasSearched">
        <div class="flex items-center justify-between mb-4">
          <p class="text-sm font-medium text-[var(--ui-text-muted)]">
            <span
              class="text-[var(--ui-text-highlighted)] font-semibold"
            >
              {{ results.length }}
            </span>
            curriculum
            {{
              results.length === 1
                ? "descriptor"
                : "descriptors"
            }}
            found
          </p>
          <UBadge variant="soft" color="primary" size="sm">
            {{ results.length }} results
          </UBadge>
        </div>

        <div class="space-y-3">
          <UCard
            v-for="(source, i) in results as SearchResult[]"
            :key="source.code ?? i"
            :ui="{ body: 'p-5' }"
            class="transition-shadow hover:shadow-md"
          >
            <div
              class="flex items-start justify-between gap-4 mb-3"
            >
              <div class="flex items-center gap-2 flex-wrap">
                <UBadge
                  v-if="source.code"
                  variant="outline"
                  color="primary"
                  size="sm"
                  class="font-mono tracking-tight"
                >
                  {{ source.code }}
                </UBadge>
                <span
                  v-if="source.meta?.yearLevel"
                  class="text-xs text-[var(--ui-text-muted)]"
                >
                  Year {{ source.meta.yearLevel }}
                </span>
                <span
                  v-if="source.meta?.strand"
                  class="text-xs text-[var(--ui-text-muted)]"
                >
                  · {{ source.meta.strand }}
                </span>
                <span
                  v-if="source.meta?.substrand"
                  class="text-xs text-[var(--ui-text-muted)]"
                >
                  · {{ source.meta.substrand }}
                </span>
              </div>

              <UBadge
                :color="badge(source.distance).color"
                variant="soft"
                size="sm"
                class="shrink-0"
              >
                {{ badge(source.distance).label }}
              </UBadge>
            </div>

            <p
              class="text-sm text-[var(--ui-text)] leading-relaxed mb-3 whitespace-pre-line"
            >
              {{ source.text }}
            </p>

            <template v-if="source.meta?.examples?.length">
              <USeparator class="my-3" />
              <div>
                <p
                  class="text-xs font-semibold uppercase tracking-wider text-[var(--ui-text-muted)] mb-2"
                >
                  Examples
                </p>
                <ul class="space-y-1">
                  <li
                    v-for="(ex, j) in source.meta.examples"
                    :key="j"
                    class="flex gap-2 text-sm text-[var(--ui-text-muted)]"
                  >
                    <UIcon
                      name="i-heroicons-check-circle"
                      class="text-[var(--ui-success)] mt-0.5 shrink-0 w-4 h-4"
                    />
                    <span>{{ ex }}</span>
                  </li>
                </ul>
              </div>
            </template>

            <template
              v-if="source.meta?.generalCapabilities?.length"
            >
              <div class="flex flex-wrap gap-1.5 mt-3">
                <UBadge
                  v-for="cap in source.meta
                      .generalCapabilities"
                  :key="cap"
                  variant="soft"
                  color="neutral"
                  size="xs"
                >
                  {{ cap }}
                </UBadge>
              </div>
            </template>
          </UCard>
        </div>
      </template>

      <div
        v-else-if="hasSearched && !loading"
        class="flex flex-col items-center justify-center py-20 text-center"
      >
        <UIcon
          name="i-heroicons-magnifying-glass-circle"
          class="w-12 h-12 text-[var(--ui-text-dimmed)] mb-4"
        />
        <p class="text-sm text-[var(--ui-text-muted)]">
          No results found. Try a different search term.
        </p>
      </div>
    </div>
  </div>
</template>
