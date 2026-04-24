<script setup lang="ts">
import { watch } from "vue";
import type { SearchFilters } from "~/types/search";
import { clearOPFS } from "~/lib/db";

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
  filterOptions,
  fetchFilterOptions,
} = useCurriculum();

const route = useRoute();
const router = useRouter()

const clearing = ref(false);

async function handleClearCache() {
  if (clearing.value) return;
  clearing.value = true;
  try {
    await clearOPFS();
    window.location.reload();
  } catch (e) {
    console.error("Failed to clear OPFS:", e);
    clearing.value = false;
  }
}

const query = ref("");
const hasSearched = ref(false);
const showFilters = ref(false);

const filterCode = ref("");
const filterYear = ref<number | null>(null);
const filterStrand = ref<string | null>(null);
const filterSubstrand = ref<string | null>(null);

const yearLevels = computed(() => filterOptions.value?.yearLevels ?? []);
const strands = computed(() => filterOptions.value?.strands ?? []);
const substrandsByStrand = computed(() => filterOptions.value?.substrandsByStrand ?? {});

const availableSubstrands = computed(() => {
  if (!filterStrand.value) return [];
  return substrandsByStrand.value[filterStrand.value] || [];
});

const activeFilterCount = computed(() => {
  let count = 0;
  if (filterCode.value) count++;
  if (filterYear.value !== null) count++;
  if (filterStrand.value) count++;
  if (filterSubstrand.value) count++;
  return count;
});

function clearFilters() {
  filterCode.value = "";
  filterYear.value = null;
  filterStrand.value = null;
  filterSubstrand.value = null;
}

async function handleSearch() {
  if (!query.value.trim()) return;
  hasSearched.value = true;

  router.replace({ query: { q: query.value.trim() } });

  const filters: SearchFilters = {};
  if (filterCode.value) filters.code = filterCode.value;
  if (filterYear.value !== null) filters.yearLevel = filterYear.value;
  if (filterStrand.value) filters.strand = filterStrand.value;
  if (filterSubstrand.value) filters.substrand = filterSubstrand.value;

  await search(query.value.trim(), Object.keys(filters).length > 0 ? filters : undefined);
}

async function handleModelLoad() {
  try {
    await loadModel();
  } catch {}
}

function openModelSelector() {
  showModelSelector.value = true;
}

function handleCloseModelSelector() {
  showModelSelector.value = false;
}

onMounted(() => {
  checkOnLoad();
  fetchFilterOptions();

  if (route.query.q) {
    query.value = route.query.q as string;
    if (isModelReady.value) {
      handleSearch();
    }
  }
});

watch(isModelReady, (ready) => {
  if (ready) {
    fetchFilterOptions();
    if (route.query.q && !hasSearched.value) {
      query.value = route.query.q as string;
      handleSearch();
    }
  }
});

</script>

<template>
  <div class="min-h-screen bg-zinc-50 dark:bg-zinc-950">
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

    <!-- Hero Header -->
    <header class="bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800">
      <div class="max-w-screen-2xl mx-auto px-6 py-12">
        <div class="flex items-center justify-between mb-4">
          <div class="flex items-center gap-2">
            <UIcon name="i-heroicons-book-open" class="w-8 h-8 text-teal-600 dark:text-teal-400" />
            <span class="text-sm font-semibold tracking-widest uppercase text-teal-600 dark:text-teal-400">
              Open Curriculum
            </span>
          </div>
          <UButton variant="ghost" color="neutral" size="sm" to="/about">
            <UIcon name="i-heroicons-information-circle" class="w-4 h-4 mr-1" />
            About
          </UButton>
        </div>
        <h1 class="text-4xl font-bold text-zinc-900 dark:text-zinc-100 mb-3">
          WA Curriculum Explorer
        </h1>
        <p class="text-lg text-zinc-500 dark:text-zinc-400 max-w-2xl">
          Search and explore the WA Curriculum content descriptions. Find learning outcomes, examples, and capabilities by keyword or topic.
        </p>
      </div>
    </header>

    <div class="max-w-screen-2xl mx-auto px-6 py-8">
      <!-- Search Section -->
      <div class="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-6 mb-8 -mt-6 relative z-10 shadow-sm">
        <div class="flex items-center justify-between mb-4">
          <UBadge
            variant="soft"
            color="neutral"
            size="md"
            class="cursor-pointer"
            @click="openModelSelector"
          >
            <UIcon name="i-heroicons-cube" class="w-3 h-3 mr-1" />
            {{ selectedModel.name }}
            <span v-if="!isModelReady && !isDownloading"> · not loaded</span>
            <span v-else-if="isDownloading"> · loading…</span>
            <UIcon name="i-heroicons-chevron-down" class="w-3 h-3 ml-1" />
          </UBadge>

          <div class="flex items-center gap-2">
            <UColorModeButton />
            <UButton
              variant="ghost"
              color="neutral"
              size="sm"
              :trailing-icon="showFilters ? 'i-heroicons-chevron-up' : 'i-heroicons-chevron-down'"
              @click="showFilters = !showFilters"
            >
              Filters
              <UBadge v-if="activeFilterCount" color="primary" variant="solid" size="xs" class="ml-1">
                {{ activeFilterCount }}
              </UBadge>
            </UButton>
          </div>
        </div>

        <div class="flex gap-2 mb-4">
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
                class="text-zinc-400"
              />
            </template>
          </UInput>
          <UButton
            size="lg"
            color="primary"
            :loading="loading"
            :disabled="!query.trim() || !isModelReady"
            @click="handleSearch"
          >
            Search
          </UButton>
        </div>

        <!-- Filters Panel -->
        <div v-if="showFilters" class="pt-4 border-t border-zinc-200 dark:border-zinc-800">
          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label class="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1.5">
                Content Code
              </label>
              <UInput
                v-model="filterCode"
                placeholder="e.g. WA6MNAC2"
                size="md"
              />
            </div>

            <div>
              <label class="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1.5">
                Year Level
              </label>
              <USelect
                v-model="filterYear"
                :items="[{ label: 'All years', value: null }, ...yearLevels.map(y => ({ label: `Year ${y}`, value: y }))]"
                placeholder="Select year"
                size="md"
              />
            </div>

            <div>
              <label class="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1.5">
                Strand
              </label>
              <USelect
                v-model="filterStrand"
                :items="[{ label: 'All strands', value: null }, ...strands.map(s => ({ label: s, value: s }))]"
                placeholder="Select strand"
                size="md"
                @update:model-value="filterSubstrand = null"
              />
            </div>

            <div>
              <label class="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1.5">
                Sub-strand
              </label>
              <USelect
                v-model="filterSubstrand"
                :items="[{ label: 'All sub-strands', value: null }, ...availableSubstrands.map(s => ({ label: s, value: s }))]"
                placeholder="Select sub-strand"
                size="md"
                :disabled="!filterStrand"
              />
            </div>
          </div>

          <div class="flex justify-end mt-4">
            <UButton
              v-if="activeFilterCount > 0"
              variant="ghost"
              color="neutral"
              size="sm"
              @click="clearFilters"
            >
              Clear filters
            </UButton>
          </div>
        </div>
      </div>

      <!-- Info Cards -->
      <div v-if="!hasSearched && !loading" class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div class="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-5">
          <div class="flex items-center gap-3 mb-3">
            <div class="w-10 h-10 rounded-lg bg-teal-50 dark:bg-teal-950 flex items-center justify-center">
              <UIcon name="i-heroicons-magnifying-glass" class="w-5 h-5 text-teal-600 dark:text-teal-400" />
            </div>
            <h3 class="font-semibold text-zinc-900 dark:text-zinc-100">Semantic Search</h3>
          </div>
          <p class="text-sm text-zinc-500 dark:text-zinc-400">
            Search by meaning, not just keywords. Ask questions naturally and find relevant curriculum content.
          </p>
        </div>

        <div class="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-5">
          <div class="flex items-center gap-3 mb-3">
            <div class="w-10 h-10 rounded-lg bg-emerald-50 dark:bg-emerald-950 flex items-center justify-center">
              <UIcon name="i-heroicons-academic-cap" class="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <h3 class="font-semibold text-zinc-900 dark:text-zinc-100">Year Levels</h3>
          </div>
          <p class="text-sm text-zinc-500 dark:text-zinc-400">
            Filter by year level to find age-appropriate content descriptions and learning outcomes.
          </p>
        </div>

        <div class="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-5">
          <div class="flex items-center gap-3 mb-3">
            <div class="w-10 h-10 rounded-lg bg-amber-50 dark:bg-amber-950 flex items-center justify-center">
              <UIcon name="i-heroicons-light-bulb" class="w-5 h-5 text-amber-600 dark:text-amber-400" />
            </div>
            <h3 class="font-semibold text-zinc-900 dark:text-zinc-100">Examples</h3>
          </div>
          <p class="text-sm text-zinc-500 dark:text-zinc-400">
            Each result includes teaching examples and general capabilities for practical classroom use.
          </p>
        </div>
      </div>

      <!-- Model not ready -->
      <div
        v-if="!isModelReady && !isDownloading"
        class="flex flex-col items-center justify-center py-16 text-center"
      >
        <UIcon
          name="i-heroicons-arrow-down-tray"
          class="w-12 h-12 text-zinc-300 dark:text-zinc-600 mb-4"
        />
        <p class="text-base text-zinc-500 dark:text-zinc-400 mb-3">
          Download a model to start searching.
        </p>
        <UButton size="sm" variant="soft" @click="openModelSelector">
          Select Model
        </UButton>
      </div>

      <!-- Loading -->
      <div v-else-if="loading" class="space-y-4">
        <USkeleton
          class="h-32 w-full rounded-xl"
          v-for="n in 3"
          :key="n"
        />
      </div>

      <!-- Error -->
      <UAlert
        v-else-if="error"
        icon="i-heroicons-exclamation-triangle"
        color="error"
        variant="soft"
        :description="error?.message"
        title="Something went wrong"
        class="mb-6"
      />

      <!-- Results -->
      <template v-else-if="results && hasSearched">
        <div class="flex items-center justify-between mb-6">
          <h2 class="text-xl font-semibold text-zinc-900 dark:text-zinc-100">
            Search Results
          </h2>
          <div class="flex items-center gap-3">
            <div v-if="activeFilterCount > 0" class="flex items-center gap-1.5 text-sm text-zinc-500">
              <UIcon name="i-heroicons-funnel" class="w-4 h-4" />
              <span>{{ activeFilterCount }} {{ activeFilterCount === 1 ? 'filter' : 'filters' }} active</span>
            </div>
            <UBadge variant="soft" color="primary" size="md">
              {{ results.length }} {{ results.length === 1 ? "descriptor" : "descriptors" }}
            </UBadge>
          </div>
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <CurriculumResultCard
            v-for="(source, i) in results"
            :key="source.code ?? i"
            :source="source"
          />
        </div>
      </template>

      <!-- No results -->
      <div
        v-else-if="hasSearched && !loading"
        class="flex flex-col items-center justify-center py-20 text-center"
      >
        <UIcon
          name="i-heroicons-magnifying-glass-circle"
          class="w-12 h-12 text-zinc-300 dark:text-zinc-600 mb-4"
        />
        <p class="text-base text-zinc-500 dark:text-zinc-400">
          No results found. Try a different search term.
        </p>
      </div>
    </div>

    <!-- Footer -->
    <footer class="border-t border-zinc-200 dark:border-zinc-800 mt-12">
      <div class="max-w-screen-2xl mx-auto px-6 py-8">
        <div class="flex items-center justify-between">
          <p class="text-sm text-zinc-500 dark:text-zinc-400">
            Open Curriculum Explorer
          </p>
          <div class="flex items-center gap-4">
            <p class="text-sm text-zinc-500 dark:text-zinc-400">
              &copy; Raoul Hofmann 2026
            </p>
          </div>
          <div class="flex items-center gap-4">
            <UButton
              variant="ghost"
              color="neutral"
              size="xs"
              to="/about"
            >
              About
            </UButton>
            <UButton
              variant="ghost"
              color="neutral"
              size="xs"
              :loading="clearing"
              @click="handleClearCache"
            >
              Clear cached data
            </UButton>
            <p class="text-sm text-zinc-500 dark:text-zinc-400">
              Powered by client-side embeddings
            </p>
          </div>
        </div>
      </div>
    </footer>
  </div>
</template>
