export { getEmbedding } from "./models";

export function expandQuery(query: string): string {
  if (query.split(" ").length <= 2) {
    return `curriculum content about ${query}`;
  }
  return query;
}
