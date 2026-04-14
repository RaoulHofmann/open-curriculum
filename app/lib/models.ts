import { ref } from "vue";
import {
  pipeline,
  type FeatureExtractionPipeline,
} from "@huggingface/transformers";

export interface EmbeddingModel {
  id: string;
  name: string;
  description: string;
  dimension: number;
  dbFile: string;
}

export const MODELS: EmbeddingModel[] = [
  {
    id: "Xenova/all-MiniLM-L6-v2",
    name: "MiniLM",
    description: "Fast, lightweight (384-dim). Good for quick searches.",
    dimension: 384,
    dbFile: "curriculum-384.sqlite",
  },
  {
    id: "mixedbread-ai/mxbai-embed-large-v1",
    name: "mxbai-embed-large",
    description: "High quality (1024-dim). Best accuracy for semantic search.",
    dimension: 1024,
    dbFile: "curriculum-1024.sqlite",
  },
];

const STORAGE_KEY = "oc:selected-model";

export const selectedModel = ref<EmbeddingModel>(
  loadSavedModel() ?? MODELS[0]!,
);
export const isModelReady = ref(false);
export const isDownloading = ref(false);
export const downloadProgress = ref(0);
export const downloadStatus = ref("");
export const showModelSelector = ref(!loadSavedModel());

export const checkOnLoad = async () => {
  const savedModel = loadSavedModel()
  if (savedModel) {
    selectedModel.value = savedModel;
    await loadModel();
  }
}

let _pipeline: FeatureExtractionPipeline | null = null;

function loadSavedModel(): EmbeddingModel | null {
  if (typeof window === "undefined") return null;
  const saved = localStorage.getItem(STORAGE_KEY);
  if (!saved) return null;
  return MODELS.find((m) => m.id === saved) ?? null;
}

export function selectModel(model: EmbeddingModel) {
  selectedModel.value = model;
  localStorage.setItem(STORAGE_KEY, model.id);
  showModelSelector.value = false;
  _pipeline = null;
  isModelReady.value = false;
}

export async function loadModel(): Promise<void> {
  if (isModelReady.value) return;

  isDownloading.value = true;
  downloadProgress.value = 0;
  downloadStatus.value = "Downloading model...";

  try {
    _pipeline = await pipeline("feature-extraction", selectedModel.value.id, {
      progress_callback: (progress: any) => {
        if (progress.status === "progress" && progress.total) {
          downloadProgress.value = Math.round(
            (progress.loaded / progress.total) * 100,
          );
          downloadStatus.value = `Downloading ${progress.file ?? "model"}... ${downloadProgress.value}%`;
        } else if (progress.status === "ready") {
          downloadStatus.value = "Model ready";
        }
      },
    });

    downloadProgress.value = 100;
    downloadStatus.value = "Model loaded";
    isModelReady.value = true;
  } catch (e) {
    downloadStatus.value = `Failed to load model: ${e instanceof Error ? e.message : String(e)}`;
    throw e;
  } finally {
    isDownloading.value = false;
  }
}

export async function getEmbeddingPipeline(): Promise<FeatureExtractionPipeline> {
  if (_pipeline) return _pipeline;
  await loadModel();
  return _pipeline!;
}

export async function getEmbedding(text: string): Promise<Float32Array> {
  const pipe = await getEmbeddingPipeline();
  const output = await pipe(text, { pooling: "mean", normalize: true });
  return new Float32Array(output.data as Float32Array);
}
