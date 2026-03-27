import { Elysia, t } from "elysia";
import { ingest } from "../services/ingest";
import { searchKnowledgeBase } from "../services/search";
import { answerWithRAG } from "../services/rag";

export const curriculumRoutes = new Elysia({ prefix: "/curriculum" })
  .get(
    "/ask",
    async ({ query }) => {
      const question = query.q || "fractions";
      const results = await searchKnowledgeBase(question);
      return { question, results };
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
      console.log("ASD");
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
