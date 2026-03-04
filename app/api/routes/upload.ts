import { Hono } from "hono";
import type { HonoEnv } from "../types";
import { requireAuth } from "../middleware";
import { ulid } from "~/lib/ulid";

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp", "image/svg+xml"];
const MAX_SIZE = 10 * 1024 * 1024; // 10MB

const upload = new Hono<HonoEnv>();

// POST /api/upload-image
upload.post("/", requireAuth, async (c) => {
  const formData = await c.req.formData();
  const file = formData.get("file") as File | null;

  if (!file || !(file instanceof File)) {
    return c.json({ error: "ファイルが選択されていません" }, 400);
  }

  if (!ALLOWED_TYPES.includes(file.type)) {
    return c.json(
      { error: "対応していないファイル形式です（JPEG, PNG, GIF, WebP, SVG のみ）" },
      400
    );
  }

  if (file.size > MAX_SIZE) {
    return c.json({ error: "ファイルサイズが大きすぎます（最大 10MB）" }, 400);
  }

  const ext = file.name.split(".").pop() || "png";
  const key = `images/${ulid()}.${ext}`;

  await c.env.R2_BUCKET.put(key, await file.arrayBuffer(), {
    httpMetadata: { contentType: file.type },
  });

  const siteUrl = c.env.SITE_URL || "https://cf-se-blog-jp.dev";
  return c.json({ url: `${siteUrl}/r2/${key}` });
});

export default upload;
