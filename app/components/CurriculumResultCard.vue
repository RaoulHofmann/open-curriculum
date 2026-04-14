<script setup lang="ts">
import type { SearchResult } from "~/types/search";

const props = defineProps<{
  source: SearchResult;
}>();

const { extractDescription, extractExamples, extractCapabilities } =
  useTextParser();

const badge = (distance?: number) => {
  if (distance === undefined)
    return { color: "neutral" as const, label: "—" };
  if (distance < 0.4)
    return { color: "success" as const, label: "High match" };
  if (distance < 0.7) return { color: "warning" as const, label: "Partial" };
  return { color: "error" as const, label: "Low match" };
};

const description = computed(() => extractDescription(props.source.text));
const examples = computed(() => extractExamples(props.source.text));
const capabilities = computed(() => {
  const fromText = extractCapabilities(props.source.text);
  return fromText.length ? fromText : props.source.meta?.capabilities ?? [];
});
</script>

<template>
  <UCard
    :ui="{ body: 'p-0' }"
    class="overflow-hidden transition-shadow hover:shadow-md"
  >
    <!-- Top meta bar -->
    <div
      class="px-5 py-3 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between gap-3"
    >
      <div class="flex items-center gap-2 flex-wrap">
        <UBadge
          v-if="source.code"
          variant="solid"
          color="primary"
          size="md"
          class="font-mono tracking-tight"
        >
          {{ source.code }}
        </UBadge>
        <span
          v-if="source.meta?.year_level"
          class="text-sm font-medium text-zinc-700 dark:text-zinc-300"
        >
          Year {{ source.meta.year_level }}
        </span>
        <span
          v-if="source.meta?.strand"
          class="text-sm text-zinc-400 dark:text-zinc-500"
        >
          · {{ source.meta.strand }}
        </span>
        <span
          v-if="source.meta?.substrand"
          class="text-sm text-zinc-400 dark:text-zinc-500"
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

    <!-- Main content with sidebar -->
    <div class="flex gap-6 p-5">
      <!-- Sidebar with metadata -->
      <div class="w-44 shrink-0 space-y-4">
        <div v-if="source.meta?.year_level" class="space-y-1">
          <p
            class="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400"
          >
            Year Level
          </p>
          <p class="text-lg font-bold text-zinc-900 dark:text-zinc-100">
            {{ source.meta.year_level }}
          </p>
        </div>

        <div v-if="source.meta?.strand" class="space-y-1">
          <p
            class="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400"
          >
            Strand
          </p>
          <p class="text-sm font-medium text-zinc-700 dark:text-zinc-300">
            {{ source.meta.strand }}
          </p>
        </div>

        <div v-if="source.meta?.substrand" class="space-y-1">
          <p
            class="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400"
          >
            Sub-strand
          </p>
          <p class="text-sm font-medium text-zinc-700 dark:text-zinc-300">
            {{ source.meta.substrand }}
          </p>
        </div>

        <div v-if="capabilities.length" class="space-y-2">
          <p
            class="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400"
          >
            Capabilities
          </p>
          <div class="flex flex-wrap gap-1.5">
            <UBadge
              v-for="cap in capabilities"
              :key="cap"
              variant="soft"
              color="neutral"
              size="sm"
            >
              {{ cap }}
            </UBadge>
          </div>
        </div>
      </div>

      <!-- Main content area -->
      <div class="flex-1 min-w-0 space-y-4">
        <!-- Description -->
        <div>
          <p class="text-base text-zinc-700 dark:text-zinc-300 leading-relaxed">
            {{ description }}
          </p>
        </div>

        <!-- Examples -->
        <div
          v-if="examples.length"
          class="bg-zinc-50 dark:bg-zinc-800/50 rounded-xl p-4 border border-zinc-100 dark:border-zinc-800"
        >
          <p
            class="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-3"
          >
            Examples
          </p>
          <div class="grid gap-2">
            <div
              v-for="(ex, j) in examples"
              :key="j"
              class="flex items-start gap-3 text-sm text-zinc-700 dark:text-zinc-300"
            >
              <span
                class="text-teal-600 dark:text-teal-400 font-mono text-xs mt-0.5"
                >{{ j + 1 }}.</span
              >
              <span class="leading-relaxed">{{ ex }}</span>
            </div>
          </div>
        </div>

        <!-- Image -->
        <template v-if="source.meta?.image_url">
          <img
            :src="source.meta.image_url"
            :alt="`Example for ${source.code}`"
            class="max-w-full h-auto rounded-lg border border-zinc-200 dark:border-zinc-700"
            loading="lazy"
          />
        </template>
      </div>
    </div>
  </UCard>
</template>