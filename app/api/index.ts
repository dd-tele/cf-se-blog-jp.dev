import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import type { HonoEnv } from "./types";
import chat from "./routes/chat";
import ai from "./routes/ai";
import upload from "./routes/upload";
import r2 from "./routes/r2";
import templatesApi from "./routes/templates";

const app = new Hono<HonoEnv>();

// ─── Global middleware ───────────────────────────────────────
app.use("*", logger());
app.use(
  "/api/*",
  cors({
    origin: "*",
    allowMethods: ["GET", "POST", "OPTIONS"],
    allowHeaders: ["Content-Type"],
  })
);

// ─── Mount routes ────────────────────────────────────────────
app.route("/api/v1/chat", chat);
app.route("/api/v1/ai", ai);
app.route("/api/upload-image", upload);
app.route("/api/v1/templates", templatesApi);
app.route("/r2", r2);

// ─── Health check ────────────────────────────────────────────
app.get("/api/health", (c) => c.json({ status: "ok" }));

export default app;
