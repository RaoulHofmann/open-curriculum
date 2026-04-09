import { Elysia, t } from "elysia";
import { ingest } from "../services/ingest";
import { searchKnowledgeBase } from "../services/search";
import { answerWithRAG } from "../services/rag";
import { sqlite } from "../db";

export const curriculumRoutes = new Elysia({ prefix: "/curriculum" })
  .get("/metadata", async () => {
    const metadata = sqlite
      .prepare(
        `
        SELECT
          json_extract(metadata, '$.yearLevel') AS year_level,
          json_extract(metadata, '$.strand')    AS strand,
          json_group_array(json_extract(metadata, '$.code')) AS codes
        FROM chunk_content
        GROUP BY
          json_extract(metadata, '$.yearLevel'),
          json_extract(metadata, '$.strand')
        ORDER BY
          year_level,
          strand
        `,
      )
      .all() as any[];

    const parsed = metadata.map((m) => ({
      ...m,
      codes: JSON.parse(m.codes),
    }));

    return { metadata: parsed };
  })
  .get(
    "/ask",
    async ({ query }) => {
      const question = query.q || "fractions";
      const answer = await searchKnowledgeBase(question);
      return { question, answer };
    },
    {
      query: t.Object({
        q: t.Optional(t.String()),
      }),
    },
  )
  .get(
    "/search",
    async ({ query }) => {
      const question = query.q || "which content code contains fractions";
      const answer = await answerWithRAG(question);
      return { question, answer };
    },
    {
      query: t.Object({
        q: t.Optional(t.String()),
      }),
    },
  )
  .post("/ingest", async () => {
    const result = await ingest();
    return { status: "success", ...result };
  });
