<script setup lang="ts">
import type { EmbeddingModel } from "~/lib/models";

const props = defineProps<{
  models: EmbeddingModel[];
  open: boolean;
  selectedModel: EmbeddingModel;
  isModelReady: boolean;
  isDownloading: boolean;
  downloadProgress: number;
  downloadStatus: string;
}>();

const emit = defineEmits<{
  select: [model: EmbeddingModel];
  load: [];
  closeModal: [];
}>();

function selectModel(model: EmbeddingModel) {
  emit("select", model);
}

function closeModal() {
  emit("closeModal");
}

function handleLoad() {
  emit("load");
}
</script>

<template>
  <UModal
    :open="open"
    :dismissible="isModelReady"
    :prevent-close="isDownloading"
    :ui="{ content: 'max-w-lg' }"
  >
    <template #content>
      <div class="p-6">
        <h2 class="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-1">
          Select an embedding model
        </h2>
        <p class="text-sm text-zinc-500 dark:text-zinc-400 mb-5">
          The model runs entirely in your browser. Pick one based on your
          speed/accuracy preference.
        </p>

        <div class="space-y-3 mb-6">
          <button
            v-for="model in models"
            :key="model.id"
            class="w-full text-left rounded-xl border-2 p-4 transition-all"
            :class="
              selectedModel.id === model.id
                ? 'border-teal-500 dark:border-teal-400 bg-teal-50 dark:bg-teal-950'
                : 'border-zinc-200 dark:border-zinc-700 hover:border-zinc-300 dark:hover:border-zinc-600'
            "
            :disabled="isDownloading"
            @click="selectModel(model)"
          >
            <div class="flex items-start justify-between gap-3">
              <div>
                <p class="font-medium text-sm text-zinc-900 dark:text-zinc-100">
                  {{ model.name }}
                </p>
                <p class="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                  {{ model.description }}
                </p>
              </div>
              <UBadge
                variant="soft"
                color="neutral"
                size="sm"
                class="shrink-0 mt-0.5"
              >
                {{ model.dimension }}d
              </UBadge>
            </div>
          </button>
        </div>

        <div
          v-if="isDownloading"
          class="mb-5"
        >
          <div class="flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400 mb-1.5">
            <span>{{ downloadStatus }}</span>
            <span>{{ downloadProgress }}%</span>
          </div>
          <UProgress
            :model-value="downloadProgress"
            :max="100"
          />
        </div>

        <div
          v-if="isModelReady && !isDownloading"
          class="mb-5 flex items-center gap-2 text-sm text-emerald-600 dark:text-emerald-400"
        >
          <UIcon name="i-heroicons-check-circle" class="w-5 h-5" />
          <span>Model loaded and ready to search</span>
        </div>

        <div class="flex justify-end gap-2">
          <UButton
            v-if="!isModelReady"
            color="primary"
            :loading="isDownloading"
            :disabled="isDownloading"
            @click="handleLoad"
          >
            Download & Load Model
          </UButton>
          <UButton
            v-else
            color="neutral"
            variant="soft"
            @click="closeModal"
          >
            Close
          </UButton>
        </div>
      </div>
    </template>
  </UModal>
</template>