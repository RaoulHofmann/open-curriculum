<script setup lang="ts">
import { clearOPFS } from "~/lib/db";

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
</script>

<template>
  <div class="min-h-screen bg-zinc-50 dark:bg-zinc-950">
    <!-- Header -->
    <header class="bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800">
      <div class="max-w-screen-2xl mx-auto px-6 py-12">
        <div class="flex items-center justify-between mb-4">
          <div class="flex items-center gap-2">
            <UIcon name="i-heroicons-book-open" class="w-8 h-8 text-teal-600 dark:text-teal-400" />
            <NuxtLink to="/" class="text-sm font-semibold tracking-widest uppercase text-teal-600 dark:text-teal-400 hover:underline">
              Open Curriculum
            </NuxtLink>
          </div>
          <UButton variant="ghost" color="neutral" size="sm" to="/">
            <UIcon name="i-heroicons-arrow-left" class="w-4 h-4 mr-1" />
            Back to search
          </UButton>
        </div>
        <h1 class="text-4xl font-bold text-zinc-900 dark:text-zinc-100 mb-3">
          About
        </h1>
        <p class="text-lg text-zinc-500 dark:text-zinc-400 max-w-2xl">
          How this tool works and what makes it different. Everything runs in your browser &mdash; no server required.
        </p>
      </div>
    </header>

    <div class="max-w-screen-2xl mx-auto px-6 py-8 space-y-8">

      <!-- What it does -->
      <section>
        <h2 class="text-xl font-bold text-zinc-900 dark:text-zinc-100 mb-4">
          What is Open Curriculum?
        </h2>
        <div class="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-6 text-zinc-600 dark:text-zinc-400">
          <p>
            Open Curriculum Explorer is a semantic search tool for the
            <strong class="text-zinc-900 dark:text-zinc-100">Western Australian Curriculum</strong>.
            Instead of relying on exact keyword matches, it understands the <em>meaning</em> of your
            search and finds content descriptions that are conceptually related.
            Search for things like <UBadge variant="soft" color="neutral">fractions</UBadge>,
            <UBadge variant="soft" color="neutral">place value</UBadge>, or
            <UBadge variant="soft" color="neutral">how plants grow</UBadge>
            and the tool will surface relevant learning outcomes, teaching examples, and general
            capabilities across all year levels.
          </p>
        </div>
      </section>

      <!-- Feature cards grid -->
      <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">

        <!-- Semantic Search -->
        <div class="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-5">
          <div class="flex items-center gap-3 mb-3">
            <div class="w-10 h-10 rounded-lg bg-teal-50 dark:bg-teal-950 flex items-center justify-center">
              <UIcon name="i-heroicons-magnifying-glass" class="w-5 h-5 text-teal-600 dark:text-teal-400" />
            </div>
            <h3 class="font-semibold text-zinc-900 dark:text-zinc-100">Semantic Search</h3>
          </div>
          <p class="text-sm text-zinc-500 dark:text-zinc-400">
            Uses <strong class="text-zinc-700 dark:text-zinc-300">embedding models</strong> to convert
            text into numerical vectors. Text with similar meaning produces similar vectors, so the
            app can find conceptually related content even when keywords don't match exactly.
            The search also blends in keyword matching to boost exact phrase hits.
          </p>
        </div>

        <!-- 100% Client-Side -->
        <div class="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-5">
          <div class="flex items-center gap-3 mb-3">
            <div class="w-10 h-10 rounded-lg bg-emerald-50 dark:bg-emerald-950 flex items-center justify-center">
              <UIcon name="i-heroicons-shield-check" class="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <h3 class="font-semibold text-zinc-900 dark:text-zinc-100">100% Client-Side</h3>
          </div>
          <p class="text-sm text-zinc-500 dark:text-zinc-400">
            No server, no API calls, no data leaves your machine. All search, embedding, and
            database operations happen entirely in your browser. No analytics, no cookies, no
            third-party tracking.
          </p>
        </div>

        <!-- Local Models -->
        <div class="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-5">
          <div class="flex items-center gap-3 mb-3">
            <div class="w-10 h-10 rounded-lg bg-violet-50 dark:bg-violet-950 flex items-center justify-center">
              <UIcon name="i-heroicons-cpu-chip" class="w-5 h-5 text-violet-600 dark:text-violet-400" />
            </div>
            <h3 class="font-semibold text-zinc-900 dark:text-zinc-100">Local Models</h3>
          </div>
          <p class="text-sm text-zinc-500 dark:text-zinc-400">
            Pre-trained embedding models run in your browser via
            <a href="https://github.com/huggingface/transformers.js" target="_blank" rel="noopener"
              class="text-teal-600 dark:text-teal-400 hover:underline">Transformers.js</a>.
            Models are converted to <strong class="text-zinc-700 dark:text-zinc-300">ONNX</strong>
            format and executed using ONNX Runtime Web. No API keys or subscriptions needed.
          </p>
        </div>

        <!-- WebAssembly -->
        <div class="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-5">
          <div class="flex items-center gap-3 mb-3">
            <div class="w-10 h-10 rounded-lg bg-amber-50 dark:bg-amber-950 flex items-center justify-center">
              <UIcon name="i-heroicons-bolt" class="w-5 h-5 text-amber-600 dark:text-amber-400" />
            </div>
            <h3 class="font-semibold text-zinc-900 dark:text-zinc-100">WebAssembly</h3>
          </div>
          <p class="text-sm text-zinc-500 dark:text-zinc-400">
            WASM lets compiled code (C, C++, Rust) run in the browser at near-native speed. This app
            uses it for two things: the <strong class="text-zinc-700 dark:text-zinc-300">SQLite engine</strong>
            and the <strong class="text-zinc-700 dark:text-zinc-300">ONNX inference engine</strong>.
            Both are compiled to WASM and run alongside JavaScript in the browser.
          </p>
        </div>

        <!-- SQLite & OPFS -->
        <div class="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-5">
          <div class="flex items-center gap-3 mb-3">
            <div class="w-10 h-10 rounded-lg bg-sky-50 dark:bg-sky-950 flex items-center justify-center">
              <UIcon name="i-heroicons-circle-stack" class="w-5 h-5 text-sky-600 dark:text-sky-400" />
            </div>
            <h3 class="font-semibold text-zinc-900 dark:text-zinc-100">Persistent Database</h3>
          </div>
          <p class="text-sm text-zinc-500 dark:text-zinc-400">
            A full SQLite database runs inside a Web Worker (background thread). On first visit
            the database downloads; on subsequent visits it loads from
            <strong class="text-zinc-700 dark:text-zinc-300">OPFS</strong> (Origin Private File System)
            &mdash; no network needed. Falls back to in-memory if OPFS isn't available.
          </p>
        </div>

        <!-- Available Models -->
        <div class="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-5">
          <div class="flex items-center gap-3 mb-3">
            <div class="w-10 h-10 rounded-lg bg-rose-50 dark:bg-rose-950 flex items-center justify-center">
              <UIcon name="i-heroicons-squares-2x2" class="w-5 h-5 text-rose-600 dark:text-rose-400" />
            </div>
            <h3 class="font-semibold text-zinc-900 dark:text-zinc-100">Two Models</h3>
          </div>
          <ul class="text-sm text-zinc-500 dark:text-zinc-400 space-y-2">
            <li>
              <strong class="text-zinc-700 dark:text-zinc-300">MiniLM</strong> &mdash;
              Fast, lightweight (384-dim). Good for quick searches.
            </li>
            <li>
              <strong class="text-zinc-700 dark:text-zinc-300">mxbai-embed-large</strong> &mdash;
              High quality (1024-dim). Best accuracy for semantic search.
            </li>
          </ul>
        </div>

      </div>

      <!-- Troubleshooting -->
      <section>
        <h2 class="text-xl font-bold text-zinc-900 dark:text-zinc-100 mb-4 flex items-center gap-2">
          <UIcon name="i-heroicons-wrench-screwdriver" class="w-5 h-5 text-zinc-500 dark:text-zinc-400" />
          Troubleshooting
        </h2>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">

          <div class="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-5">
            <h3 class="font-semibold text-zinc-900 dark:text-zinc-100 mb-2">Search returns no results</h3>
            <p class="text-sm text-zinc-500 dark:text-zinc-400">
              Try rephrasing your query. Semantic search works best with natural language or
              short phrases rather than single keywords.
            </p>
          </div>

          <div class="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-5">
            <h3 class="font-semibold text-zinc-900 dark:text-zinc-100 mb-2">Model won't load</h3>
            <p class="text-sm text-zinc-500 dark:text-zinc-400">
              Ensure a stable internet connection for the initial download. If loading fails
              repeatedly, try clearing cached data and reloading.
            </p>
          </div>

          <div class="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-5">
            <h3 class="font-semibold text-zinc-900 dark:text-zinc-100 mb-2">Database not persisting</h3>
            <p class="text-sm text-zinc-500 dark:text-zinc-400">
              If the database re-downloads every time, your browser may not support OPFS or the
              required security headers. This is normal in older browsers and incognito mode.
            </p>
          </div>

          <div class="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-5">
            <h3 class="font-semibold text-zinc-900 dark:text-zinc-100 mb-2">Slow performance</h3>
            <p class="text-sm text-zinc-500 dark:text-zinc-400">
              The first search may be slower as the inference engine warms up. If consistently
              slow, try the MiniLM model which trades accuracy for speed.
            </p>
          </div>

        </div>

        <!-- Clear cached data -->
        <div class="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-5 mt-4">
          <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h3 class="font-semibold text-zinc-900 dark:text-zinc-100 mb-1">Clear Cached Data</h3>
              <p class="text-sm text-zinc-500 dark:text-zinc-400">
                Removes the stored database and forces a fresh download on next use. Your selected
                model preference will also be reset.
              </p>
            </div>
            <UButton
              color="error"
              variant="soft"
              size="sm"
              :loading="clearing"
              class="shrink-0"
              @click="handleClearCache"
            >
              Clear cached data &amp; reload
            </UButton>
          </div>
        </div>
      </section>

      <!-- Back link -->
      <div class="text-center pb-8">
        <UButton variant="ghost" color="neutral" to="/">
          <UIcon name="i-heroicons-arrow-left" class="w-4 h-4 mr-1" />
          Back to search
        </UButton>
      </div>
    </div>

    <!-- Footer -->
    <footer class="border-t border-zinc-200 dark:border-zinc-800">
      <div class="max-w-screen-2xl mx-auto px-6 py-8">
        <div class="flex items-center justify-between">
          <p class="text-sm text-zinc-500 dark:text-zinc-400">
            Open Curriculum Explorer
          </p>
          <p class="text-sm text-zinc-500 dark:text-zinc-400">
            &copy; Raoul Hofmann 2026
          </p>
        </div>
      </div>
    </footer>
  </div>
</template>
