import { Hono } from "hono";
import type { HonoEnv } from "../types";
import { requireAuth } from "../middleware";
import { ulid } from "~/lib/ulid";

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp", "image/svg+xml"];
const MAX_SIZE = 10 * 1024 * 1024; // 10MB per image
const MAX_IMAGES = 20;

// Regex to find markdown image syntax: ![alt](url)
const MD_IMAGE_RE = /!\[([^\]]*)\]\((https?:\/\/[^)]+)\)/g;

// Guess extension from content-type
function extFromContentType(ct: string): string {
  const map: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/gif": "gif",
    "image/webp": "webp",
    "image/svg+xml": "svg",
  };
  return map[ct] || "png";
}

// Guess content-type from URL extension as fallback
function guessTypeFromUrl(url: string): string | null {
  const ext = url.split(/[?#]/)[0].split(".").pop()?.toLowerCase();
  const map: Record<string, string> = {
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    gif: "image/gif",
    webp: "image/webp",
    svg: "image/svg+xml",
  };
  return (ext && map[ext]) || null;
}

const importImages = new Hono<HonoEnv>();

// POST /api/v1/import-images
// Body: { markdown: string }
// Returns: { markdown: string, imported: number, errors: string[] }
importImages.post("/", requireAuth, async (c) => {
  const { markdown } = await c.req.json<{ markdown: string }>();
  if (!markdown) {
    return c.json({ error: "markdown is required" }, 400);
  }

  const siteUrl = c.env.SITE_URL || "https://cf-se-blog-jp.dev";
  const bucket = c.env.R2_BUCKET;

  // Collect all external image URLs
  const images: { full: string; alt: string; url: string }[] = [];
  let match: RegExpExecArray | null;
  const re = new RegExp(MD_IMAGE_RE.source, MD_IMAGE_RE.flags);
  while ((match = re.exec(markdown)) !== null) {
    const url = match[2];
    // Skip images already on our domain
    if (url.startsWith(siteUrl) || url.includes("/r2/images/")) continue;
    images.push({ full: match[0], alt: match[1], url });
  }

  if (images.length === 0) {
    return c.json({ markdown, imported: 0, errors: [] });
  }

  if (images.length > MAX_IMAGES) {
    return c.json(
      { error: `画像が多すぎます（最大 ${MAX_IMAGES} 枚）。${images.length} 枚検出されました。` },
      400
    );
  }

  const errors: string[] = [];
  const replacements: Map<string, string> = new Map();

  // Download & upload each image in parallel
  await Promise.all(
    images.map(async (img) => {
      try {
        const res = await fetch(img.url, {
          headers: { "User-Agent": "CloudflareBlogImporter/1.0" },
          redirect: "follow",
        });

        if (!res.ok) {
          errors.push(`${img.url}: HTTP ${res.status}`);
          return;
        }

        let contentType = res.headers.get("content-type")?.split(";")[0].trim() || "";
        // Some CDNs return generic content-type; fall back to URL extension
        if (!ALLOWED_TYPES.includes(contentType)) {
          const guessed = guessTypeFromUrl(img.url);
          if (guessed) contentType = guessed;
        }

        if (!ALLOWED_TYPES.includes(contentType)) {
          errors.push(`${img.url}: 非対応の形式 (${contentType})`);
          return;
        }

        const buf = await res.arrayBuffer();
        if (buf.byteLength > MAX_SIZE) {
          errors.push(`${img.url}: サイズ超過 (${(buf.byteLength / 1024 / 1024).toFixed(1)}MB)`);
          return;
        }

        const ext = extFromContentType(contentType);
        const key = `images/${ulid()}.${ext}`;

        await bucket.put(key, buf, {
          httpMetadata: { contentType },
        });

        const newUrl = `${siteUrl}/r2/${key}`;
        replacements.set(img.url, newUrl);
      } catch (e: any) {
        errors.push(`${img.url}: ${e.message || "取得失敗"}`);
      }
    })
  );

  // Replace URLs in markdown
  let result = markdown;
  for (const [oldUrl, newUrl] of replacements) {
    // Replace all occurrences of this URL (could appear multiple times)
    result = result.split(oldUrl).join(newUrl);
  }

  return c.json({
    markdown: result,
    imported: replacements.size,
    errors,
  });
});

export default importImages;
