import { Elysia } from "elysia";
import { curriculumRoutes } from "./server/routes/curriculum";

export default () => new Elysia().use(curriculumRoutes);
