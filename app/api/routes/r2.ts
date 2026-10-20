import { Hono } from "hono";
import type { HonoEnv } from "../types";

const r2 = new Hono<HonoEnv>();

// Only editor-uploaded images are public. Other prefixes in the bucket
// (slides/, case-guides/) may belong to limited or unpublished content and are
// served by their own routes with access control.
const PUBLIC_PREFIXES = ["images/"];

// GET /r2/:key{.+} — Serve public R2 objects (images uploaded from the editor)
r2.get("/*", async (c) => {
  const key = c.req.path.replace(/^\/r2\//, "");
  if (!key || key.includes("..") || !PUBLIC_PREFIXES.some((p) => key.startsWith(p))) {
    return c.notFound();
  }

  const object = await c.env.R2_BUCKET.get(key);
  if (!object) return c.notFound();

  return new Response(object.body as ReadableStream, {
    headers: {
      "Content-Type": object.httpMetadata?.contentType || "application/octet-stream",
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
    },
  });
});

export default r2;
