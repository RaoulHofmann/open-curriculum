/**
 * RAG orchestration service
 *
 * - Uses the existing `searchKnowledgeBase` to retrieve relevant chunks for a query.
 * - Assembles a prompt with retrieved context, user question, and instructions.
 * - Calls local Ollama (`qwen3.5:0.8b` by default) via the HTTP API to generate an answer.
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

import { searchKnowledgeBase } from "./search";

const OLLAMA_HOST = process.env.OLLAMA_HOST || "http://localhost:11434";
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || "qwen3.5:0.8b";

export interface RagOptions {
  k?: number; // how many items to retrieve from vector DB
  maxContextChars?: number; // max chars to include from retrieved docs
  maxTokens?: number; // max tokens for the LLM generation
  temperature?: number;
  // extra instructions to include in the prompt
  extraInstructions?: string;
}

export interface RagResult {
  answer: string;
  sources: Array<{
    code?: string;
    title?: string;
    distance?: number;
    meta?: Record<string, any>;
  }>;
  raw: any; // raw response from Ollama (as returned)
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

Answer:
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
  const max_tokens = opts?.maxTokens ?? 512;
  const temperature =
    typeof opts?.temperature === "number" ? opts.temperature : 0.0;

  const url = `${OLLAMA_HOST}/api/generate`;

  const payload = {
    model,
    prompt,
    max_tokens,
    temperature,
  };

  const resp = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!resp.ok) {
    const txt = await resp.text().catch(() => "");
    throw new Error(
      `Ollama generate error ${resp.status}: ${resp.statusText} - ${txt}`,
    );
  }

  const contentType = resp.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    const json = await resp.json();
    // common shapes:
    // { text: "..." } or { choices: [{ text: "..." }]} or { output: [{ content: [{ type: "output_text", text: "..." }] }] }
    let text: string | undefined;

    if (typeof json.text === "string") {
      text = json.text;
    } else if (
      Array.isArray(json.choices) &&
      typeof json.choices[0]?.text === "string"
    ) {
      text = json.choices[0].text;
    } else if (Array.isArray(json.output)) {
      // Ollama sometimes returns `output` array with content
      try {
        for (const out of json.output) {
          if (Array.isArray(out?.content)) {
            for (const c of out.content) {
              if (typeof c?.text === "string") {
                text = (text ? text + "\n" : "") + c.text;
              } else if (typeof c === "string") {
                text = (text ? text + "\n" : "") + c;
              }
            }
          } else if (typeof out?.text === "string") {
            text = (text ? text + "\n" : "") + out.text;
          }
        }
      } catch (e) {
        // fallthrough
      }
    }

    return { raw: json, text };
  } else {
    // not JSON, return as text
    const txt = await resp.text();
    return { raw: txt, text: txt };
  }
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
  const maxTokens = options?.maxTokens ?? 512;
  const temperature = options?.temperature ?? 0.0;

  // 1) Retrieve candidates from vector DB
  const retrieved = await searchKnowledgeBase(userQuery, k);

  // 2) Build context
  const context = buildContextFromResults(retrieved, maxContextChars);

  console.log(context);

  // 3) Build prompt with helpful instructions
  const prompt = buildPrompt({
    question: userQuery,
    context,
    extraInstructions: options?.extraInstructions,
    maxAnswerChars: Math.floor((maxTokens / 1.5) * 4), // heuristic: roughly bytes/chars
  });

  console.log(prompt);

  // 4) Call Ollama
  const response = await callOllama(prompt, {
    model: OLLAMA_MODEL,
    maxTokens,
    temperature,
  });
  console.log(response);
  // Extract the best text we can
  const answerText =
    (response && (response.text ?? response?.raw?.text)) ||
    (typeof response.raw === "string" ? response.raw : "");

  // 5) Prepare source metadata to return
  const sources = retrieved.map((r, i) => ({
    code: r.code,
    title: r.meta?.title || r.meta?.source || `source_${i + 1}`,
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
