import { ref, shallowRef } from "vue";
import * as webllm from "@mlc-ai/web-llm";

export interface WebLLMState {
  status: "idle" | "loading" | "ready" | "error";
  progress: number;
  error: string | null;
}

const DEFAULT_MODEL = "Llama-3.2-3B-Instruct-q4f32_1-MLC";

export function useWebLLM() {
  const engine = shallowRef<webllm.MLCEngine | null>(null);
  const state = ref<WebLLMState>({
    status: "idle",
    progress: 0,
    error: null,
  });

  async function initEngine(modelId = DEFAULT_MODEL) {
    if (engine.value) return engine.value;

    state.value = { status: "loading", progress: 0, error: null };

    try {
      const initProgressCallback = (report: webllm.InitProgressReport) => {
        const pct = report.progress != null ? Math.round(report.progress * 100) : 0;
        state.value.progress = pct;
      };

      const eng = await webllm.CreateMLCEngine(modelId, {
        initProgressCallback,
      });

      engine.value = eng;
      state.value = { status: "ready", progress: 100, error: null };
      return eng;
    } catch (e: any) {
      state.value = {
        status: "error",
        progress: 0,
        error: e?.message ?? "Failed to load model",
      };
      throw e;
    }
  }

  async function generate(prompt: string): Promise<string> {
    if (!engine.value) {
      throw new Error("Engine not initialized. Call initEngine() first.");
    }

    const reply = await engine.value.chat.completions.create({
      messages: [{ role: "user", content: prompt }],
      temperature: 0.0,
      max_tokens: 2048,
    });

    return reply.choices[0]?.message?.content ?? "";
  }

  async function generateStream(prompt: string, onChunk: (text: string) => void) {
    if (!engine.value) {
      throw new Error("Engine not initialized. Call initEngine() first.");
    }

    const chunks = await engine.value.chat.completions.create({
      messages: [{ role: "user", content: prompt }],
      temperature: 0.0,
      max_tokens: 2048,
      stream: true,
    });

    let full = "";
    for await (const chunk of chunks) {
      const delta = chunk.choices[0]?.delta?.content ?? "";
      if (delta) {
        full += delta;
        onChunk(full);
      }
    }

    return full;
  }

  return {
    engine,
    state,
    initEngine,
    generate,
    generateStream,
  };
}
