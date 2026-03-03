import { defineConfig } from "drizzle-kit";

export default defineConfig({
  out: "./migrations",
  schema: "./app/db/schema.ts",
  dialect: "sqlite",
});
