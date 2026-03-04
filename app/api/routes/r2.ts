import { Hono } from "hono";
import type { HonoEnv } from "../types";

const r2 = new Hono<HonoEnv>();

// GET /r2/:key{.+} — Serve R2 objects (images etc.)
r2.get("/*", async (c) => {
  const key = c.req.path.replace(/^\/r2\//, "");
  if (!key) return c.notFound();

  const object = await c.env.R2_BUCKET.get(key);
  if (!object) return c.notFound();

  return new Response(object.body as ReadableStream, {
    headers: {
      "Content-Type": object.httpMetadata?.contentType || "application/octet-stream",
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
});

export default r2;
