// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: "2025-07-15",
  devtools: { enabled: true },
  modules: ["@nuxt/eslint", "nuxt-elysia", "@nuxt/ui"],
  nitro: {
    preset: "Bun",
  },
  css: ["~/assets/css/main.css"],
  runtimeConfig: {
    ollamaHost: process.env.OLLAMA_HOST || "http://localhost:11434",
    embeddingModel: process.env.EMBEDDING_MODEL || "nomic-embed-text",
    dbFileName: process.env.DB_FILE_NAME || "curriculum.sqlite",
  },
  vite: {
    optimizeDeps: {
      include: ["@vue/devtools-core", "@vue/devtools-kit", "@elysiajs/eden"],
    },
  },
});
