<script setup lang="ts">
import type { RagSource } from "~/types";

const {
    ask,
    search,
    result,
    ragAnswer,
    error,
    loading,
    generating,
    llmState,
    initStatus,
} = useCurriculum();

const query = ref("fractions");
const hasSearched = ref(false);
const mode = ref<"search" | "ask">("ask");

async function handleSearch() {
    if (!query.value.trim()) return;
    hasSearched.value = true;
    if (mode.value === "ask") {
        await ask(query.value.trim());
    } else {
        await search(query.value.trim());
    }
}

onMounted(() => handleSearch());

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
        <div class="max-w-3xl mx-auto px-4 py-12">
            <!-- Header -->
            <div class="mb-10">
                <p
                    class="text-xs font-semibold tracking-widest uppercase text-[var(--ui-text-muted)] mb-2"
                >
                    Curriculum Explorer
                </p>
                <h1
                    class="text-3xl font-bold text-[var(--ui-text-highlighted)] mb-1"
                >
                    What would you like to teach?
                </h1>
                <p class="text-sm text-[var(--ui-text-muted)]">
                    Search the curriculum knowledge base using natural language.
                    Runs entirely in your browser.
                </p>
            </div>

            <!-- WebLLM model loading -->
            <div
                v-if="llmState.status === 'loading'"
                class="mb-6 p-4 rounded-xl bg-[var(--ui-bg-muted)] border border-[var(--ui-border)]"
            >
                <div class="flex items-center gap-3 mb-2">
                    <UIcon
                        name="i-heroicons-arrow-path"
                        class="w-4 h-4 animate-spin text-[var(--ui-primary)]"
                    />
                    <p class="text-sm font-medium text-[var(--ui-text)]">
                        Loading WebLLM model…
                    </p>
                </div>
                <div
                    class="w-full h-2 bg-[var(--ui-bg-muted)] rounded-full overflow-hidden"
                >
                    <div
                        class="h-full bg-[var(--ui-primary)] transition-all duration-300"
                        :style="{ width: `${llmState.progress}%` }"
                    />
                </div>
                <p
                    class="text-xs text-[var(--ui-text-muted)] mt-1 text-right"
                >
                    {{ llmState.progress }}%
                </p>
            </div>

            <!-- Embedding / init status -->
            <div
                v-else-if="initStatus"
                class="mb-6 p-4 rounded-xl bg-[var(--ui-bg-muted)] border border-[var(--ui-border)]"
            >
                <div class="flex items-center gap-3">
                    <UIcon
                        name="i-heroicons-arrow-path"
                        class="w-4 h-4 animate-spin text-[var(--ui-primary)]"
                    />
                    <p class="text-sm text-[var(--ui-text-muted)]">
                        {{ initStatus }}
                    </p>
                </div>
            </div>

            <!-- Model error -->
            <UAlert
                v-if="llmState.status === 'error' && mode === 'ask'"
                icon="i-heroicons-exclamation-triangle"
                color="error"
                variant="soft"
                :description="llmState.error ?? 'Model failed to load'"
                title="WebLLM Error"
                class="mb-6"
            />

            <!-- Mode toggle + Search bar -->
            <div class="flex gap-2 mb-4">
                <UButton
                    :variant="mode === 'search' ? 'solid' : 'outline'"
                    size="sm"
                    @click="mode = 'search'"
                >
                    Search
                </UButton>
                <UButton
                    :variant="mode === 'ask' ? 'solid' : 'outline'"
                    size="sm"
                    icon="i-heroicons-sparkles"
                    @click="mode = 'ask'"
                >
                    Ask (LLM)
                </UButton>
            </div>

            <div class="flex gap-2 mb-10">
                <UInput
                    v-model="query"
                    placeholder="e.g. fractions, place value, geometry…"
                    size="lg"
                    class="flex-1"
                    :disabled="loading || generating"
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
                    :loading="loading || generating"
                    :disabled="!query.trim()"
                    :icon="
                        mode === 'ask'
                            ? 'i-heroicons-sparkles'
                            : 'i-heroicons-magnifying-glass'
                    "
                    @click="handleSearch"
                >
                    {{ mode === "ask" ? "Ask" : "Search" }}
                </UButton>
            </div>

            <!-- Generating indicator -->
            <div
                v-if="generating"
                class="mb-6 p-4 rounded-xl bg-[var(--ui-bg-muted)] border border-[var(--ui-border)]"
            >
                <div class="flex items-center gap-3">
                    <UIcon
                        name="i-heroicons-arrow-path"
                        class="w-4 h-4 animate-spin text-[var(--ui-primary)]"
                    />
                    <p class="text-sm text-[var(--ui-text-muted)]">
                        WebLLM is generating an answer…
                    </p>
                </div>
            </div>

            <!-- Loading skeleton -->
            <div v-if="loading && !initStatus" class="space-y-3">
                <USkeleton
                    class="h-28 w-full rounded-xl"
                    v-for="n in 4"
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

            <!-- RAG answer -->
            <template v-if="ragAnswer && !generating">
                <UCard
                    class="mb-6 ring-1 ring-[var(--ui-primary)]"
                    :ui="{ body: 'p-5' }"
                >
                    <template #header>
                        <div class="flex items-center gap-2">
                            <UIcon
                                name="i-heroicons-sparkles"
                                class="text-[var(--ui-primary)]"
                            />
                            <p
                                class="text-sm font-semibold text-[var(--ui-text-highlighted)]"
                            >
                                AI Answer
                            </p>
                        </div>
                    </template>
                    <p
                        class="text-sm text-[var(--ui-text)] leading-relaxed whitespace-pre-wrap"
                    >
                        {{ ragAnswer }}
                    </p>
                </UCard>
            </template>

            <!-- Results -->
            <template v-if="result && hasSearched">
                <!-- Source count -->
                <div class="flex items-center justify-between mb-4">
                    <p class="text-sm font-medium text-[var(--ui-text-muted)]">
                        <span
                            class="text-[var(--ui-text-highlighted)] font-semibold"
                        >
                            {{ result.answer.length }}
                        </span>
                        curriculum
                        {{
                            result.answer.length === 1
                                ? "descriptor"
                                : "descriptors"
                        }}
                        found for <em>"{{ result.question }}"</em>
                    </p>
                    <UBadge variant="soft" color="primary" size="sm">
                        {{ result.answer.length }} results
                    </UBadge>
                </div>

                <!-- Source cards -->
                <div class="space-y-3">
                    <UCard
                        v-for="(source, i) in result.answer as RagSource[]"
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
                                    {{ source.meta.yearLevel }}
                                </span>
                                <span
                                    v-if="source.meta?.strand"
                                    class="text-xs text-[var(--ui-text-muted)]"
                                >
                                    · {{ source.meta.strand }}
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
                            class="text-sm text-[var(--ui-text)] leading-relaxed mb-3"
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

            <!-- Empty state -->
            <div
                v-else-if="hasSearched && !loading && !generating"
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
