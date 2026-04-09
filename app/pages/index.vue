<script setup lang="ts">
import type { RagSource } from "~~/server/types";

const { ask, result, error, loading } = useCurriculum();

const query = ref("fractions");
const hasSearched = ref(false);

async function handleSearch() {
    if (!query.value.trim()) return;
    hasSearched.value = true;
    await ask(query.value.trim());
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
                </p>
            </div>

            <!-- Search bar -->
            <div class="flex gap-2 mb-10">
                <UInput
                    v-model="query"
                    placeholder="e.g. fractions, place value, geometry…"
                    size="lg"
                    class="flex-1"
                    :disabled="loading"
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
                    :disabled="!query.trim()"
                    icon="i-heroicons-sparkles"
                    @click="handleSearch"
                >
                    Search
                </UButton>
            </div>

            <!-- Loading skeleton -->
            <div v-if="loading" class="space-y-3">
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

            <!-- Results -->
            <template v-else-if="result && hasSearched">
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
                            <!-- Code badge + title -->
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

                            <!-- Match quality -->
                            <UBadge
                                :color="badge(source.distance).color"
                                variant="soft"
                                size="sm"
                                class="shrink-0"
                            >
                                {{ badge(source.distance).label }}
                            </UBadge>
                        </div>

                        <!-- Description text -->
                        <p
                            class="text-sm text-[var(--ui-text)] leading-relaxed mb-3"
                        >
                            {{ source.text }}
                        </p>

                        <!-- Examples -->
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

                        <!-- General capabilities chips -->
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
