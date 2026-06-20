import { unzipSync } from "fflate";

// Limits to keep uploads sane and protect storage.
export const MAX_BUNDLE_FILES = 400;
export const MAX_BUNDLE_UNCOMPRESSED = 40 * 1024 * 1024; // 40MB total
export const MAX_ENTRY_HTML = 3 * 1024 * 1024; // 3MB entry HTML

const MIME_BY_EXT: Record<string, string> = {
  html: "text/html; charset=utf-8",
  htm: "text/html; charset=utf-8",
  css: "text/css; charset=utf-8",
  js: "text/javascript; charset=utf-8",
  mjs: "text/javascript; charset=utf-8",
  json: "application/json; charset=utf-8",
  map: "application/json; charset=utf-8",
  svg: "image/svg+xml",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  avif: "image/avif",
  ico: "image/x-icon",
  bmp: "image/bmp",
  woff: "font/woff",
  woff2: "font/woff2",
  ttf: "font/ttf",
  otf: "font/otf",
  eot: "application/vnd.ms-fontobject",
  mp4: "video/mp4",
  webm: "video/webm",
  mp3: "audio/mpeg",
  wav: "audio/wav",
  ogg: "audio/ogg",
  pdf: "application/pdf",
  txt: "text/plain; charset=utf-8",
  xml: "application/xml; charset=utf-8",
  wasm: "application/wasm",
};

/** Content-Type for a file path based on its extension. */
export function contentTypeFor(path: string): string {
  const ext = path.split(".").pop()?.toLowerCase() ?? "";
  return MIME_BY_EXT[ext] ?? "application/octet-stream";
}

function dirOf(path: string): string {
  const i = path.lastIndexOf("/");
  return i < 0 ? "" : path.slice(0, i + 1);
}

function isJunk(path: string): boolean {
  return (
    path.endsWith("/") || // directory entry
    path.startsWith("__MACOSX/") ||
    path.includes("/__MACOSX/") ||
    path.split("/").some((seg) => seg === ".DS_Store" || seg === "..")
  );
}

export interface UnpackedBundle {
  entryPath: string; // relative path of entry html (after root-strip)
  entryHtml: string;
  /** Asset files keyed by their path relative to the entry directory. */
  assets: { path: string; data: Uint8Array }[];
  fileCount: number;
}

/**
 * Extract a slide ZIP bundle: locate the entry HTML, normalise paths so the
 * entry sits at the bundle root, and return the entry HTML plus all sibling
 * assets ready to be stored.
 */
export function unpackSlideBundle(buffer: ArrayBuffer): UnpackedBundle {
  let files: Record<string, Uint8Array>;
  try {
    files = unzipSync(new Uint8Array(buffer));
  } catch {
    throw new Error("ZIP ファイルを展開できませんでした。破損していないか確認してください。");
  }

  const entries = Object.entries(files).filter(([p]) => !isJunk(p));
  if (entries.length === 0) {
    throw new Error("ZIP の中に有効なファイルが見つかりませんでした。");
  }
  if (entries.length > MAX_BUNDLE_FILES) {
    throw new Error(`ファイル数が多すぎます（最大 ${MAX_BUNDLE_FILES} 件）。`);
  }

  let total = 0;
  for (const [, data] of entries) total += data.byteLength;
  if (total > MAX_BUNDLE_UNCOMPRESSED) {
    throw new Error("展開後の合計サイズが大きすぎます（最大 40MB）。");
  }

  // Pick the entry HTML: prefer an index.html, else the shallowest .html.
  const htmlFiles = entries
    .map(([p]) => p)
    .filter((p) => /\.html?$/i.test(p));
  if (htmlFiles.length === 0) {
    throw new Error("エントリとなる HTML ファイルが ZIP に含まれていません。");
  }
  const depth = (p: string) => p.split("/").length;
  htmlFiles.sort((a, b) => {
    const ai = /(^|\/)index\.html?$/i.test(a) ? 0 : 1;
    const bi = /(^|\/)index\.html?$/i.test(b) ? 0 : 1;
    if (ai !== bi) return ai - bi;
    if (depth(a) !== depth(b)) return depth(a) - depth(b);
    return a.localeCompare(b);
  });
  const entryAbs = htmlFiles[0];
  const root = dirOf(entryAbs);

  const rel = (p: string) => (root && p.startsWith(root) ? p.slice(root.length) : p);
  const entryPath = rel(entryAbs);

  const entryData = files[entryAbs];
  if (entryData.byteLength > MAX_ENTRY_HTML) {
    throw new Error("エントリ HTML が大きすぎます（最大 3MB）。");
  }
  const entryHtml = new TextDecoder().decode(entryData);

  const assets: { path: string; data: Uint8Array }[] = [];
  for (const [p, data] of entries) {
    if (p === entryAbs) continue;
    const relPath = rel(p);
    if (!relPath || relPath.includes("..")) continue;
    assets.push({ path: relPath, data });
  }

  return { entryPath, entryHtml, assets, fileCount: entries.length };
}

/** Store bundle assets in R2 under `slides/<slideId>/<relpath>`. */
export async function storeBundleAssets(
  r2: R2Bucket,
  slideId: string,
  assets: { path: string; data: Uint8Array }[]
): Promise<void> {
  const prefix = `slides/${slideId}`;
  await Promise.all(
    assets.map((a) =>
      r2.put(`${prefix}/${a.path}`, a.data as unknown as ArrayBuffer, {
        httpMetadata: { contentType: contentTypeFor(a.path) },
      })
    )
  );
}

/** Delete all R2 objects under a slide's asset prefix. */
export async function deleteBundleAssets(
  r2: R2Bucket,
  assetPrefix: string
): Promise<void> {
  let cursor: string | undefined;
  do {
    const listing = await r2.list({ prefix: `${assetPrefix}/`, cursor });
    if (listing.objects.length) {
      await r2.delete(listing.objects.map((o) => o.key));
    }
    cursor = listing.truncated ? listing.cursor : undefined;
  } while (cursor);
}
