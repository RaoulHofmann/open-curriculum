import type { SearchResult } from "~/types";

export function buildContextFromResults(
  results: SearchResult[],
  maxChars = 3000,
) {
  const pieces: string[] = [];
  let used = 0;

  for (let i = 0; i < results.length; i++) {
    const r = results[i];
    const title = r?.meta?.code || r?.code || `source_${i + 1}`;
    const header = `[[Source ${i + 1}]] ${title} (score=${typeof r?.distance === "number" ? r?.distance.toFixed(4) : "n/a"})\n`;
    const snippet = r?.text?.trim() ?? "";
    const maxForThis = Math.max(0, maxChars - used - header.length - 20);
    let body = snippet;
    if (body.length > maxForThis) {
      body = body.slice(0, Math.max(0, maxForThis - 12)) + "\n...[truncated]";
    }

    const piece = `${header}${body}\n\n`;
    if (used + piece.length > maxChars) break;
    pieces.push(piece);
    used += piece.length;
  }

  return pieces.join("");
}

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

  return `
${instructions.join("\n")}

Context:
${context}

User question:
${question}

Answer:
`.trim();
}
