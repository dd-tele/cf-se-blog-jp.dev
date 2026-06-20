import { eq, desc, and, like, or, sql } from "drizzle-orm";
import { getDb } from "~/lib/db.server";
import { slides, users } from "~/db/schema";
import { ulid } from "~/lib/ulid";
import { slugify } from "~/lib/utils";
import type { SessionUser } from "~/lib/auth.server";

// ─── Permissions ───────────────────────────────────────────

/**
 * Whether a user may upload slides.
 * Admin and SE roles are always allowed. Other roles require the
 * `can_upload_slides` flag, which an admin grants per user.
 */
export async function userCanUploadSlides(
  db: D1Database,
  user: SessionUser
): Promise<boolean> {
  if (user.role === "admin" || user.role === "se") return true;
  const d = getDb(db);
  const row = await d
    .select({ can: users.can_upload_slides })
    .from(users)
    .where(eq(users.id, user.id))
    .get();
  return !!row?.can;
}

// ─── HTML processing ───────────────────────────────────────

/**
 * Rewrite the relative template-asset references that the slide
 * templates use (e.g. `./cf-template-cover.svg`, `styles.css`) so
 * they resolve to the shared assets served from `/slides-assets/`,
 * regardless of the URL the slide is served at.
 */
export function rewriteSlideAssets(html: string): string {
  return html
    // cf-template-*.svg referenced as ./x, x, or already-absolute are normalized
    .replace(
      /(["'(])(?:\.?\/)?(cf-template-[\w-]+\.svg)/g,
      "$1/slides-assets/$2"
    )
    // shared styles.css from the template kit
    .replace(/(["'(])(?:\.?\/)?(styles\.css)(["')])/g, "$1/slides-assets/$2$3")
    // collapse any accidental double prefixes
    .replace(/\/slides-assets\/slides-assets\//g, "/slides-assets/");
}

/** Count the number of reveal.js sections (top-level slide estimate). */
export function countSlides(html: string): number {
  const matches = html.match(/<section\b/gi);
  return matches ? matches.length : 0;
}

/** Pull a human title out of the document, preferring <title>, then first <h1>. */
export function extractTitle(html: string): string | null {
  const titleTag = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (titleTag?.[1]?.trim()) return decodeEntities(titleTag[1].trim());
  const h1 = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  if (h1?.[1]) {
    const text = h1[1].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    if (text) return decodeEntities(text);
  }
  return null;
}

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ");
}

export interface SlideHtmlValidation {
  ok: boolean;
  error?: string;
  slideCount: number;
  detectedTitle: string | null;
}

/** Basic structural validation that the upload is a usable slide deck. */
export function validateSlideHtml(html: string): SlideHtmlValidation {
  const slideCount = countSlides(html);
  const detectedTitle = extractTitle(html);
  const looksLikeHtml = /<html[\s>]/i.test(html) || /<body[\s>]/i.test(html);

  if (!looksLikeHtml) {
    return {
      ok: false,
      error: "完全な HTML ドキュメント（<html> / <body> を含む）をアップロードしてください。",
      slideCount,
      detectedTitle,
    };
  }
  if (slideCount === 0) {
    return {
      ok: false,
      error:
        "スライド（<section> 要素）が見つかりませんでした。reveal.js テンプレート形式の HTML をアップロードしてください。",
      slideCount,
      detectedTitle,
    };
  }
  return { ok: true, slideCount, detectedTitle };
}

// ─── Slug ──────────────────────────────────────────────────

export async function generateUniqueSlug(
  db: D1Database,
  title: string,
  preferred?: string
): Promise<string> {
  const d = getDb(db);
  let base = slugify(preferred || title);
  if (!base) base = "slide";
  let candidate = base;
  let i = 1;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const existing = await d
      .select({ id: slides.id })
      .from(slides)
      .where(eq(slides.slug, candidate))
      .get();
    if (!existing) return candidate;
    i += 1;
    candidate = `${base}-${i}`;
  }
}

// ─── Queries ───────────────────────────────────────────────

export async function getPublishedSlides(
  db: D1Database,
  opts: { limit?: number; offset?: number; search?: string } = {}
) {
  const { limit = 24, offset = 0, search } = opts;
  const d = getDb(db);

  const conditions = [eq(slides.status, "published")];
  if (search) {
    conditions.push(
      or(
        like(slides.title, `%${search}%`),
        like(slides.description, `%${search}%`),
        like(slides.event_name, `%${search}%`)
      )!
    );
  }

  return d
    .select({
      id: slides.id,
      title: slides.title,
      slug: slides.slug,
      description: slides.description,
      eventName: slides.event_name,
      presentedAt: slides.presented_at,
      coverImageUrl: slides.cover_image_url,
      slideCount: slides.slide_count,
      authorId: slides.author_id,
      authorName: sql<string>`COALESCE(${users.nickname}, ${users.display_name}, ${slides.author_name_snapshot})`.as(
        "author_name"
      ),
      tagsJson: slides.tags_json,
      visibility: slides.visibility,
      viewCount: slides.view_count,
      createdAt: slides.created_at,
    })
    .from(slides)
    .leftJoin(users, eq(slides.author_id, users.id))
    .where(and(...conditions))
    .orderBy(desc(slides.created_at))
    .limit(limit)
    .offset(offset);
}

export async function getSlideBySlug(db: D1Database, slug: string) {
  const d = getDb(db);
  return d
    .select({
      id: slides.id,
      title: slides.title,
      slug: slides.slug,
      description: slides.description,
      eventName: slides.event_name,
      presentedAt: slides.presented_at,
      coverImageUrl: slides.cover_image_url,
      slideCount: slides.slide_count,
      authorId: slides.author_id,
      authorName: sql<string>`COALESCE(${users.nickname}, ${users.display_name}, ${slides.author_name_snapshot})`.as(
        "author_name"
      ),
      tagsJson: slides.tags_json,
      status: slides.status,
      visibility: slides.visibility,
      viewCount: slides.view_count,
      createdAt: slides.created_at,
      updatedAt: slides.updated_at,
    })
    .from(slides)
    .leftJoin(users, eq(slides.author_id, users.id))
    .where(eq(slides.slug, slug))
    .get();
}

/** Returns the raw stored HTML for a slide (already asset-rewritten on save). */
export async function getSlideHtmlBySlug(
  db: D1Database,
  slug: string
): Promise<{ html: string; status: string; visibility: string } | null> {
  const d = getDb(db);
  const row = await d
    .select({
      html: slides.html,
      status: slides.status,
      visibility: slides.visibility,
    })
    .from(slides)
    .where(eq(slides.slug, slug))
    .get();
  return row ?? null;
}

export async function getUserSlides(db: D1Database, authorId: string) {
  const d = getDb(db);
  return d
    .select({
      id: slides.id,
      title: slides.title,
      slug: slides.slug,
      eventName: slides.event_name,
      slideCount: slides.slide_count,
      status: slides.status,
      visibility: slides.visibility,
      viewCount: slides.view_count,
      createdAt: slides.created_at,
    })
    .from(slides)
    .where(eq(slides.author_id, authorId))
    .orderBy(desc(slides.created_at));
}

export async function incrementSlideView(db: D1Database, id: string) {
  const d = getDb(db);
  await d
    .update(slides)
    .set({ view_count: sql`view_count + 1` })
    .where(eq(slides.id, id));
}

// ─── Mutations ─────────────────────────────────────────────

export interface CreateSlideInput {
  title: string;
  description?: string;
  eventName?: string;
  presentedAt?: string;
  rawHtml: string;
  coverImageUrl?: string;
  tagsJson?: string;
  status?: "draft" | "published";
  visibility?: "public" | "limited";
  slug?: string;
}

export async function createSlide(
  db: D1Database,
  input: CreateSlideInput,
  user: SessionUser
) {
  const d = getDb(db);
  const html = rewriteSlideAssets(input.rawHtml);
  const slideCount = countSlides(html);
  const title = input.title.trim();
  const slug = await generateUniqueSlug(db, title, input.slug);
  const id = ulid();
  const now = new Date().toISOString().replace("T", " ").slice(0, 19);

  await d.insert(slides).values({
    id,
    title,
    slug,
    description: input.description?.trim() || null,
    event_name: input.eventName?.trim() || null,
    presented_at: input.presentedAt || null,
    html,
    cover_image_url: input.coverImageUrl || null,
    slide_count: slideCount,
    author_id: user.id,
    author_name_snapshot: user.displayName,
    status: input.status ?? "published",
    visibility: input.visibility ?? "public",
    tags_json: input.tagsJson || null,
    created_at: now,
    updated_at: now,
  });

  return { id, slug, slideCount };
}

export async function deleteSlide(db: D1Database, id: string, authorId: string) {
  const d = getDb(db);
  await d.delete(slides).where(and(eq(slides.id, id), eq(slides.author_id, authorId)));
}
