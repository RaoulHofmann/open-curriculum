/**
 * RAG orchestration service
 *
 * - Uses the existing `searchKnowledgeBase` to retrieve relevant chunks for a query.
 * - Assembles a prompt with retrieved context, user question, and instructions.
 * - Calls local Ollama (`gemma3:1b` by default) via the HTTP API to generate an answer.
 *
 * Exports:
 * - `answerWithRAG(query, opts)` -> { answer, sources, raw }
 * - `buildContextFromResults(results, maxChars)` helper for context assembly
 * - `callOllama(prompt, opts)` low-level caller
 *
 * Notes:
 * - This file assumes the local Ollama HTTP endpoints behave similarly to earlier code in the repo.
 * - Adjust `OLLAMA_HOST` or `OLLAMA_MODEL` via env vars if your local setup differs.
 */

import { RagResult } from "../types";
import { searchKnowledgeBase } from "./search";

const OLLAMA_HOST = process.env.OLLAMA_HOST || "http://localhost:11434";
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || "llama3.2:3b";

export interface RagOptions {
  k?: number; // how many items to retrieve from vector DB
  maxContextChars?: number; // max chars to include from retrieved docs
  maxTokens?: number; // max tokens for the LLM generation
  temperature?: number;
  // extra instructions to include in the prompt
  extraInstructions?: string;
}

/**
 * Assemble a textual context from search results.
 * Truncates snippets to keep total size under maxChars.
 */
export function buildContextFromResults(
  results: Array<{
    code?: string;
    text: string;
    distance?: number;
    meta?: Record<string, any>;
  }>,
  maxChars = 3000,
) {
  const pieces: string[] = [];
  let used = 0;

  for (let i = 0; i < results.length; i++) {
    const r = results[i];
    const title =
      (r?.meta && (r?.meta.title || r?.meta.source || r?.meta.url)) ||
      r?.code ||
      `source_${i + 1}`;
    const header = `[[Source ${i + 1}]] ${title} (score=${typeof r?.distance === "number" ? r?.distance.toFixed(4) : "n/a"})\n`;
    const snippet = r?.text?.trim() ?? "";
    // leave some room for header and separators
    const maxForThis = Math.max(0, maxChars - used - header.length - 20);
    let body = snippet;
    if (body.length > maxForThis) {
      body = body.slice(0, Math.max(0, maxForThis - 12)) + "\n...[truncated]";
    }

    const piece = `${header}${body}\n\n`;
    if (used + piece.length > maxChars) {
      // no room for this piece; stop
      break;
    }
    pieces.push(piece);
    used += piece.length;
  }

  return pieces.join("");
}

/**
 * Build the final prompt that will be sent to the LLM.
 * The prompt includes clear instructions about using the context and citing sources.
 */
export function buildPrompt(params: {
  question: string;
  context: string;
  extraInstructions?: string;
  maxAnswerChars?: number;
}) {
  const { question, context, extraInstructions, maxAnswerChars } = params;

  const instructions = [
    "You are a helpful assistant that answers user questions using ONLY the provided context whenever possible.",
    "If the context does not contain the answer, say you don't know and do NOT hallucinate facts.",
    "Cite sources inline using [Source N] notation where N is the source number from the context.",
    "Be concise and focus on answering the user's question directly.",
  ];

  if (extraInstructions) {
    instructions.push(extraInstructions);
  }

  if (typeof maxAnswerChars === "number") {
    instructions.push(
      `Limit your final answer to approximately ${maxAnswerChars} characters.`,
    );
  }

  const prompt = `
${instructions.join("\n")}

Context:
${context}

User question:
${question}

Answer: /no_think
`.trim();

  return prompt;
}

/**
 * Call the local Ollama HTTP generate endpoint.
 * Attempts to gracefully parse several possible response shapes.
 */
export async function callOllama(
  prompt: string,
  opts?: { model?: string; maxTokens?: number; temperature?: number },
) {
  const model = opts?.model || OLLAMA_MODEL;
  const num_predict = opts?.maxTokens ?? 512;
  const temperature =
    typeof opts?.temperature === "number" ? opts.temperature : 0.0;

  const url = `${OLLAMA_HOST}/api/generate`;

  const payload = {
    model,
    prompt,
    stream: false,
    options: {
      num_predict,
      temperature,
      think: false,
      enable_thinking: false,
    },
  };

  const resp = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!resp.ok) {
    const txt = await resp.text().catch(() => "");
    throw new Error(`Ollama error ${resp.status}: ${resp.statusText} - ${txt}`);
  }

  const json = await resp.json();
  return { raw: json, text: json.response as string | undefined };
}

/**
 * High-level function: run a RAG flow for `userQuery`.
 * Returns the generated answer, the sources that were used (with minimal metadata), and the raw LLM response.
 */
export async function answerWithRAG(
  userQuery: string,
  options?: RagOptions,
): Promise<RagResult> {
  const k = options?.k ?? 5;
  const maxContextChars = options?.maxContextChars ?? 3000;
  const maxTokens = options?.maxTokens ?? 2048;
  const temperature = options?.temperature ?? 0.0;

  const retrieved = await searchKnowledgeBase(userQuery, k);

  const context = buildContextFromResults(retrieved, maxContextChars);

  const prompt = buildPrompt({
    question: userQuery,
    context,
    extraInstructions: options?.extraInstructions,
    maxAnswerChars: Math.floor((maxTokens / 1.5) * 4), // heuristic: roughly bytes/chars
  });

  const response = await callOllama(prompt, {
    model: OLLAMA_MODEL,
    maxTokens,
    temperature,
  });

  const answerText =
    response.text ||
    response?.raw?.response ||
    (typeof response.raw === "string" ? response.raw : "");

  const sources = retrieved.map((r, i) => ({
    code: r.code,
    text: r.text,
    title: r.meta?.title || `source_${i + 1}`,
    distance: r.distance,
    meta: r.meta,
  }));

  return {
    answer: typeof answerText === "string" ? answerText.trim() : "",
    sources,
    raw: response.raw ?? response,
  };
}

export default {
  buildContextFromResults,
  buildPrompt,
  callOllama,
  answerWithRAG,
};
