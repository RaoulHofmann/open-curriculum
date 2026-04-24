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
      <div class="max-w-3xl mx-auto px-6 py-12">
        <div class="flex items-center gap-2 mb-4">
          <UIcon name="i-heroicons-book-open" class="w-8 h-8 text-teal-600 dark:text-teal-400" />
          <NuxtLink to="/" class="text-sm font-semibold tracking-widest uppercase text-teal-600 dark:text-teal-400 hover:underline">
            Open Curriculum
          </NuxtLink>
        </div>
        <h1 class="text-4xl font-bold text-zinc-900 dark:text-zinc-100 mb-3">
          About
        </h1>
        <p class="text-lg text-zinc-500 dark:text-zinc-400">
          How this tool works and what makes it different.
        </p>
      </div>
    </header>

    <div class="max-w-3xl mx-auto px-6 py-8 space-y-10">

      <!-- What it does -->
      <section>
        <h2 class="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mb-4">
          What is Open Curriculum?
        </h2>
        <div class="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-6 space-y-4 text-zinc-600 dark:text-zinc-400">
          <p>
            Open Curriculum Explorer is a semantic search tool for the
            <strong class="text-zinc-900 dark:text-zinc-100">Western Australian Curriculum</strong>.
            Instead of relying on exact keyword matches, it understands the <em>meaning</em> of your
            search and finds content descriptions that are conceptually related.
          </p>
          <p>
            Search for things like <UBadge variant="soft" color="neutral">fractions</UBadge>,
            <UBadge variant="soft" color="neutral">place value</UBadge>, or
            <UBadge variant="soft" color="neutral">how plants grow</UBadge>
            and the tool will surface relevant learning outcomes, teaching examples, and general
            capabilities across all year levels.
          </p>
        </div>
      </section>

      <!-- How it works: 100% client-side -->
      <section>
        <h2 class="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mb-4">
          100% Client-Side
        </h2>
        <div class="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-6 space-y-4 text-zinc-600 dark:text-zinc-400">
          <p>
            Everything runs in your browser. There is no server, no API calls, and no data
            leaves your machine. Once the page loads, all search, embedding, and database
            operations happen entirely on your device.
          </p>
        </div>
      </section>

      <!-- How it works: Semantic Embeddings -->
      <section>
        <h2 class="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mb-4">
          How Semantic Search Works
        </h2>
        <div class="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-6 space-y-4 text-zinc-600 dark:text-zinc-400">
          <p>
            Semantic search uses <strong class="text-zinc-900 dark:text-zinc-100">embedding models</strong>
            &mdash; small AI models that convert text into numerical vectors. Two pieces of text
            that mean similar things will produce vectors that are close together in mathematical
            space.
          </p>
          <p>
            When you type a search query, the app converts your text into a vector, then
            compares it against thousands of pre-computed vectors for every curriculum content
            description. The closest matches are returned as results.
          </p>
          <p>
            The search also blends in traditional keyword matching so that exact phrase matches
            are boosted, giving you the best of both approaches.
          </p>
        </div>
      </section>

      <!-- How it works: Local Models & WASM -->
      <section>
        <h2 class="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mb-4 flex items-center gap-2">
          <UIcon name="i-heroicons-cpu-chip" class="w-6 h-6 text-teal-600 dark:text-teal-400" />
          Local Models &amp; WebAssembly
        </h2>
        <div class="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-6 space-y-6 text-zinc-600 dark:text-zinc-400">
          <div>
            <h3 class="font-semibold text-zinc-900 dark:text-zinc-100 mb-2">Embedding Models</h3>
            <p>
              The app ships with pre-trained embedding models that run entirely in the browser
              using
              <a href="https://github.com/huggingface/transformers.js" target="_blank" rel="noopener"
                class="text-teal-600 dark:text-teal-400 hover:underline">Transformers.js</a>.
              These models are converted to the
              <strong class="text-zinc-900 dark:text-zinc-100">ONNX</strong> format and executed
              locally using
              <a href="https://onnxruntime.ai/" target="_blank" rel="noopener"
                class="text-teal-600 dark:text-teal-400 hover:underline">ONNX Runtime Web</a>,
              which compiles to WebAssembly for near-native performance in the browser.
            </p>
            <p class="mt-3">Two models are available:</p>
            <ul class="mt-2 space-y-2 list-disc list-inside">
              <li>
                <strong class="text-zinc-900 dark:text-zinc-100">MiniLM</strong>
                &mdash; Fast and lightweight (384-dimensional vectors). Good for quick searches.
              </li>
              <li>
                <strong class="text-zinc-900 dark:text-zinc-100">mxbai-embed-large</strong>
                &mdash; Higher quality (1024-dimensional vectors). Best accuracy for semantic search.
              </li>
            </ul>
          </div>

          <div>
            <h3 class="font-semibold text-zinc-900 dark:text-zinc-100 mb-2">What is WebAssembly (WASM)?</h3>
            <p>
              WebAssembly is a binary instruction format that runs in web browsers at near-native
              speed. It allows complex software written in languages like C, C++, and Rust to be
              compiled and run directly in the browser alongside JavaScript.
            </p>
            <p class="mt-3">
              This app uses WASM in two critical ways:
            </p>
            <ul class="mt-2 space-y-2 list-disc list-inside">
              <li>
                <strong class="text-zinc-900 dark:text-zinc-100">SQLite WASM</strong>
                &mdash; The entire SQLite database engine is compiled to WebAssembly, allowing a
                full relational database to run inside the browser.
              </li>
              <li>
                <strong class="text-zinc-900 dark:text-zinc-100">ONNX Runtime</strong>
                &mdash; The machine learning inference engine is compiled to WebAssembly, enabling
                the embedding models to run locally without a server.
              </li>
            </ul>
          </div>

          <div>
            <h3 class="font-semibold text-zinc-900 dark:text-zinc-100 mb-2">Why Local?</h3>
            <p>
              Running models locally means your search queries never leave your device. There are
              no API keys, no subscriptions, and no privacy concerns. The first load downloads the
              model files, but after that everything works offline.
            </p>
          </div>
        </div>
      </section>

      <!-- SQLite & OPFS -->
      <section>
        <h2 class="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mb-4 flex items-center gap-2">
          <UIcon name="i-heroicons-circle-stack" class="w-6 h-6 text-amber-600 dark:text-amber-400" />
          Database &amp; Persistent Storage
        </h2>
        <div class="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-6 space-y-4 text-zinc-600 dark:text-zinc-400">
          <p>
            Curriculum content and pre-computed embeddings are stored in a SQLite database that
            runs inside a
            <strong class="text-zinc-900 dark:text-zinc-100">Web Worker</strong>
            &mdash; a background thread that keeps the UI responsive.
          </p>
          <p>
            On first visit, the database file is downloaded and stored in the browser's
            <strong class="text-zinc-900 dark:text-zinc-100">Origin Private File System (OPFS)</strong>.
            On subsequent visits, the database loads directly from local storage, skipping the
            network download entirely.
          </p>
          <p>
            OPFS requires two security headers
            (<code class="text-xs bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded">Cross-Origin-Opener-Policy</code>
            and
            <code class="text-xs bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded">Cross-Origin-Embedder-Policy</code>)
            which the app sets via a service worker. If these headers aren't supported by your
            browser, the app falls back to an in-memory database that re-downloads on each visit.
          </p>
        </div>
      </section>

      <!-- Privacy -->
      <section>
        <h2 class="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mb-4 flex items-center gap-2">
          <UIcon name="i-heroicons-shield-check" class="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
          Privacy
        </h2>
        <div class="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-6 space-y-4 text-zinc-600 dark:text-zinc-400">
          <p>
            No data is collected, tracked, or transmitted. Your search queries, results, and
            preferences stay entirely on your device. The app has no analytics, no cookies, and
            no third-party tracking.
          </p>
        </div>
      </section>

      <!-- Troubleshooting -->
      <section>
        <h2 class="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mb-4 flex items-center gap-2">
          <UIcon name="i-heroicons-wrench-screwdriver" class="w-6 h-6 text-zinc-500 dark:text-zinc-400" />
          Troubleshooting
        </h2>
        <div class="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-6 space-y-6 text-zinc-600 dark:text-zinc-400">
          <div>
            <h3 class="font-semibold text-zinc-900 dark:text-zinc-100 mb-2">Search returns no results</h3>
            <p>Try rephrasing your query. Semantic search works best with natural language or short phrases rather than single keywords.</p>
          </div>

          <div>
            <h3 class="font-semibold text-zinc-900 dark:text-zinc-100 mb-2">Model won't load</h3>
            <p>
              Make sure you have a stable internet connection for the initial model download.
              Model files are cached after the first download. If loading fails repeatedly, try
              clearing cached data (below) and reloading.
            </p>
          </div>

          <div>
            <h3 class="font-semibold text-zinc-900 dark:text-zinc-100 mb-2">Database not persisting between sessions</h3>
            <p>
              If the database re-downloads every time you visit, your browser may not support
              OPFS or the required security headers. This is normal in some older browsers and
              private/incognito modes. The app will still work, it just won't cache the database.
            </p>
          </div>

          <div>
            <h3 class="font-semibold text-zinc-900 dark:text-zinc-100 mb-2">Slow performance</h3>
            <p>
              The first search after loading a model may be slower as the browser warms up the
              inference engine. Subsequent searches should be fast. If performance is consistently
              slow, try the MiniLM model which trades some accuracy for speed.
            </p>
          </div>

          <div class="pt-4 border-t border-zinc-200 dark:border-zinc-800">
            <h3 class="font-semibold text-zinc-900 dark:text-zinc-100 mb-2">Clear Cached Data</h3>
            <p class="mb-4">
              If the app is behaving unexpectedly, clearing cached data will remove the stored
              database and force a fresh download on next use. Your selected model preference
              will also be reset.
            </p>
            <UButton
              color="error"
              variant="soft"
              size="sm"
              :loading="clearing"
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
      <div class="max-w-3xl mx-auto px-6 py-8">
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
