import wasm from "vite-plugin-wasm";
import topLevelAwait from "vite-plugin-top-level-await";

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: "2025-07-15",
  devtools: { enabled: true },
  modules: ["@nuxt/eslint", "@nuxt/ui"],
  css: ["~/assets/css/main.css"],
  ssr: false,
  colorMode: {
    preference: "light",
    fallback: "light",
  },
  app: {
    baseURL: "/open-curriculum/",
  },
  vite: {
    plugins: [wasm(), topLevelAwait()],
    server: {
      headers: {
        'Cross-Origin-Opener-Policy': 'same-origin',
        'Cross-Origin-Embedder-Policy': 'require-corp',
      }
    },
    preview: {
      headers: {
        'Cross-Origin-Opener-Policy': 'same-origin',
        'Cross-Origin-Embedder-Policy': 'require-corp',
      }
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
    routeRules: {
      "/**": {
        headers: {
          "Cross-Origin-Embedder-Policy": "require-corp",
          "Cross-Origin-Opener-Policy": "same-origin",
        },
      },
    },
  },
});
