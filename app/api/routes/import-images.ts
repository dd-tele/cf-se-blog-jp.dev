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

/**
 * Import external images in markdown content to R2.
 * Returns updated markdown with URLs replaced.
 */
export async function importExternalImages(
  markdown: string,
  bucket: R2Bucket,
  siteUrl: string
): Promise<{ markdown: string; imported: number }> {
  const images: { url: string }[] = [];
  let match: RegExpExecArray | null;
  const re = new RegExp(MD_IMAGE_RE.source, MD_IMAGE_RE.flags);
  while ((match = re.exec(markdown)) !== null) {
    const url = match[2];
    if (url.startsWith(siteUrl) || url.includes("/r2/images/")) continue;
    images.push({ url });
  }

  if (images.length === 0) return { markdown, imported: 0 };

  const replacements: Map<string, string> = new Map();

  await Promise.all(
    images.slice(0, MAX_IMAGES).map(async (img) => {
      try {
        const res = await fetch(img.url, {
          headers: { "User-Agent": "CloudflareBlogImporter/1.0" },
          redirect: "follow",
        });
        if (!res.ok) return;

        let contentType = res.headers.get("content-type")?.split(";")[0].trim() || "";
        if (!ALLOWED_TYPES.includes(contentType)) {
          const guessed = guessTypeFromUrl(img.url);
          if (guessed) contentType = guessed;
        }
        if (!ALLOWED_TYPES.includes(contentType)) return;

        const buf = await res.arrayBuffer();
        if (buf.byteLength > MAX_SIZE) return;

        const ext = extFromContentType(contentType);
        const key = `images/${ulid()}.${ext}`;
        await bucket.put(key, buf, { httpMetadata: { contentType } });

        replacements.set(img.url, `${siteUrl}/r2/${key}`);
      } catch {
        // Silently skip failed images
      }
    })
  );

  let result = markdown;
  for (const [oldUrl, newUrl] of replacements) {
    result = result.split(oldUrl).join(newUrl);
  }
  return { markdown: result, imported: replacements.size };
}

const importImages = new Hono<HonoEnv>();

// POST /api/v1/import-images
importImages.post("/", requireAuth, async (c) => {
  const { markdown } = await c.req.json<{ markdown: string }>();
  if (!markdown) {
    return c.json({ error: "markdown is required" }, 400);
  }

  const siteUrl = c.env.SITE_URL || "https://cf-se-blog-jp.dev";
  const result = await importExternalImages(markdown, c.env.R2_BUCKET, siteUrl);
  return c.json({ ...result, errors: [] });
});

export default importImages;
