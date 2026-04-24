import { pipeline, env } from "@huggingface/transformers";
import { fileURLToPath } from "url";
import { dirname, resolve, join } from "path";
import {
  createWriteStream,
  mkdirSync,
  existsSync,
  copyFileSync,
  readdirSync,
  statSync,
  rmSync,
} from "fs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const MODEL_ID = "Xenova/all-MiniLM-L6-v2";
const OUT_DIR = resolve(__dirname, "..", "public/models");
const CACHE_DIR = resolve(__dirname, "..", "node_modules/@huggingface/transformers/.cache");

function copyDir(src, dest) {
  if (!existsSync(dest)) mkdirSync(dest, { recursive: true });
  for (const entry of readdirSync(src)) {
    const srcPath = join(src, entry);
    const destPath = join(dest, entry);
    if (statSync(srcPath).isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      copyFileSync(srcPath, destPath);
    }
  }
}

async function downloadModel() {
  console.log(`Downloading ${MODEL_ID}...`);

  if (existsSync(OUT_DIR)) {
    rmSync(OUT_DIR, { recursive: true, force: true });
  }
  mkdirSync(OUT_DIR, { recursive: true });

  console.log("Creating pipeline (triggers model download)...");

  const extractor = await pipeline("feature-extraction", MODEL_ID, {
    dtype: "q8",
  });

  console.log("Model ready");

  const modelCacheDir = join(CACHE_DIR, MODEL_ID);
  const modelOutDir = join(OUT_DIR, MODEL_ID);

  console.log(`Copying ${MODEL_ID} to public/models/...`);
  copyDir(modelCacheDir, modelOutDir);

  console.log(`\n✓ Model copied to public/models/${MODEL_ID}/`);
  console.log(`  Files: ${readdirSync(modelOutDir).join(", ")}`);
}

downloadModel().catch(console.error);