import { pipeline, type FeatureExtractionPipeline } from "@huggingface/transformers";

let extractor: FeatureExtractionPipeline | null = null;
let loadingPromise: Promise<FeatureExtractionPipeline> | null = null;
let device: "webgpu" | "wasm" = "webgpu";

export type ProgressCallback = (status: string, progress?: number) => void;

async function getExtractor(onProgress?: ProgressCallback): Promise<FeatureExtractionPipeline> {
  if (extractor) return extractor;
  if (loadingPromise) return loadingPromise;

  loadingPromise = (async () => {
    onProgress?.("Loading embedding model...");

    try {
      extractor = await pipeline(
        "feature-extraction",
        "Xenova/all-MiniLM-L6-v2",
        {
          device: "webgpu",
          progress_callback: (p: any) => {
            if (p.status === "progress") {
              onProgress?.(`Downloading model: ${p.file ?? ""}`, p.progress);
            } else if (p.status === "ready") {
              onProgress?.("Model ready");
            }
          },
        },
      );
      device = "webgpu";
    } catch {
      // Fallback to WASM if WebGPU is not available
      onProgress?.("WebGPU unavailable, falling back to WASM...");
      extractor = await pipeline(
        "feature-extraction",
        "Xenova/all-MiniLM-L6-v2",
        {
          device: "wasm",
          progress_callback: (p: any) => {
            if (p.status === "progress") {
              onProgress?.(`Downloading model: ${p.file ?? ""}`, p.progress);
            } else if (p.status === "ready") {
              onProgress?.("Model ready");
            }
          },
        },
      );
      device = "wasm";
    }

    return extractor!;
  })();

  return loadingPromise;
}

function normalize(v: number[]): number[] {
  const mag = Math.sqrt(v.reduce((sum, x) => sum + x * x, 0));
  if (mag === 0) return v;
  return v.map((x) => x / mag);
}

export async function getEmbedding(
  text: string,
  onProgress?: ProgressCallback,
): Promise<number[]> {
  const pipe = await getExtractor(onProgress);
  onProgress?.("Computing embedding...");
  const output = await pipe(text, { pooling: "mean", normalize: true });
  const data = output.data as Float32Array;
  return normalize(Array.from(data));
}

export async function getEmbeddings(
  texts: string[],
  onProgress?: ProgressCallback,
): Promise<number[][]> {
  const pipe = await getExtractor(onProgress);
  const dim = 384; // all-MiniLM-L6-v2 dimension
  const results: number[][] = [];

  for (let i = 0; i < texts.length; i++) {
    onProgress?.(`Embedding ${i + 1}/${texts.length}`);
    const output = await pipe(texts[i], { pooling: "mean", normalize: true });
    const data = output.data as Float32Array;
    results.push(normalize(Array.from(data)));
  }

  return results;
}
