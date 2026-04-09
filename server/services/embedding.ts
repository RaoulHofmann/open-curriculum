const OLLAMA_HOST = process.env.OLLAMA_HOST || "http://localhost:11434";
const EMBEDDING_MODEL = process.env.EMBEDDING_MODEL || "mxbai-embed-large";

function normalise(v: number[]): number[] {
  const mag = Math.sqrt(v.reduce((sum, x) => sum + x * x, 0));
  if (mag === 0) return v;
  return v.map((x) => x / mag);
}

export async function getOllamaEmbedding(prompt: string): Promise<number[]> {
  const response = await fetch(`${OLLAMA_HOST}/api/embeddings`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model: EMBEDDING_MODEL, prompt }),
  });

  if (!response.ok) {
    throw new Error(`Ollama API error: ${response.statusText}`);
  }

  const data = (await response.json()) as { embedding: number[] };

  // Verify + enforce unit norm
  const raw = data.embedding;
  const mag = Math.sqrt(raw.reduce((sum, x) => sum + x * x, 0));
  console.debug(`[embedding] magnitude: ${mag.toFixed(6)}`); // remove once confirmed

  return normalise(raw);
}
