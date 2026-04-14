import wasm from "vite-plugin-wasm";
import topLevelAwait from "vite-plugin-top-level-await";

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: "2025-07-15",
  devtools: { enabled: true },
  modules: ["@nuxt/eslint", "@nuxt/ui"],
  css: ["~/assets/css/main.css"],
  ssr: false,
  app: {
    baseURL: "/",
    head: {
      title: "WA Curriculum Search",
      htmlAttrs: {
        lang: "en",
      },
      link: [{ rel: "icon", type: "image/x-icon", href: "/favicon.ico" }],
      script: [{ src: "/service-worker.js" }],
    },
  },
  colorMode: {
    preference: "light",
    fallback: "light",
  },
  vite: {
    plugins: [wasm(), topLevelAwait()],
    server: {
      headers: {
        "Cross-Origin-Opener-Policy": "same-origin",
        "Cross-Origin-Embedder-Policy": "require-corp",
      },
    },
    preview: {
      headers: {
        "Cross-Origin-Opener-Policy": "same-origin",
        "Cross-Origin-Embedder-Policy": "require-corp",
      },
    },
    optimizeDeps: {
      exclude: ["@sqlite.org/sqlite-wasm"],
      include: [
        "@vue/devtools-core",
        "@vue/devtools-kit",
        "@huggingface/transformers",
      ],
    },
  },
  nitro: {
    preset: "github_pages",
    experimental: {
      wasm: true,
    },
  },
});
