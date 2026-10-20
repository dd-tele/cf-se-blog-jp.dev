import {
  unpackSlideBundle,
  storeBundleAssets,
  deleteBundleAssets,
  type UnpackedBundle,
} from "~/lib/slides-bundle.server";
import { userCanUploadSlides } from "~/lib/slides.server";
import { ulid } from "~/lib/ulid";
import type { SessionUser } from "~/lib/auth.server";

// 事例 - 設計ガイド (case guides) are self-contained HTML documents uploaded as
// a ZIP (index.html + assets/). The entry HTML is stored in posts.content so the
// existing editor, search and publish flow keep working; every other file is
// stored in R2 under a versioned prefix and served relative to /cases/:slug/a/.

/** Compressed ZIP upload limit. */
export const MAX_GUIDE_ZIP_BYTES = 30 * 1024 * 1024;
/** D1 rows are limited to ~2MB; keep the entry HTML comfortably below that. */
export const MAX_GUIDE_HTML_BYTES = 1_500_000;

/** Uploading guides follows the same permission model as slides. */
export function userCanUploadGuides(db: D1Database, user: SessionUser): Promise<boolean> {
  return userCanUploadSlides(db, user);
}

export function isZipFile(file: File | null): file is File {
  return (
    !!file &&
    file.size > 0 &&
    (/\.zip$/i.test(file.name) ||
      file.type === "application/zip" ||
      file.type === "application/x-zip-compressed")
  );
}

export interface ParsedGuide {
  bundle: UnpackedBundle;
  title: string | null;
}

/** Title from <title>, falling back to the sidebar brand or the first <h1>. */
export function extractGuideTitle(html: string): string | null {
  const clean = (s: string | undefined) =>
    s
      ?.replace(/<br\s*\/?>/gi, " ")
      .replace(/<[^>]+>/g, "")
      .replace(/\s+/g, " ")
      .trim() || null;
  return (
    clean(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]) ??
    clean(html.match(/class="brand"[^>]*>\s*<b>([\s\S]*?)<\/b>/i)?.[1]) ??
    clean(html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1])
  );
}

/** Unpack and validate a guide ZIP. Throws an Error with a Japanese message. */
export async function parseGuideZip(file: File): Promise<ParsedGuide> {
  if (file.size > MAX_GUIDE_ZIP_BYTES) {
    throw new Error("ZIP ファイルが大きすぎます（最大 30MB）。");
  }
  const bundle = unpackSlideBundle(await file.arrayBuffer());
  if (!/<html[\s>]/i.test(bundle.entryHtml) && !/<body[\s>]/i.test(bundle.entryHtml)) {
    throw new Error("エントリ HTML（index.html）が HTML 文書として認識できません。");
  }
  if (new TextEncoder().encode(bundle.entryHtml).byteLength > MAX_GUIDE_HTML_BYTES) {
    throw new Error("index.html が大きすぎます（最大 1.5MB）。画像は埋め込まず assets/ に分けてください。");
  }
  return { bundle, title: extractGuideTitle(bundle.entryHtml) };
}

/**
 * A fresh versioned prefix so a replaced guide never serves stale cached
 * screenshots. Allocate it *before* storing so a partial upload can be cleaned up.
 */
export function newGuidePrefix(postId: string): string {
  return `case-guides/${postId}/${ulid().toLowerCase()}`;
}

export async function storeGuideAssets(
  r2: R2Bucket,
  postId: string,
  bundle: UnpackedBundle,
  prefix: string
): Promise<void> {
  await storeBundleAssets(r2, postId, bundle.assets, prefix);
}

/** Security headers for the uploaded guide HTML (see guide-token.server.ts). */
export const GUIDE_ENTRY_CSP =
  "sandbox allow-scripts allow-popups allow-popups-to-escape-sandbox; frame-ancestors 'self'; base-uri 'none'; object-src 'none'";

export async function deleteGuideAssets(r2: R2Bucket, prefix: string | null | undefined): Promise<void> {
  if (!prefix || !prefix.startsWith("case-guides/")) return;
  await deleteBundleAssets(r2, prefix);
}
