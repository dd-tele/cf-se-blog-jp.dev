import { eq, desc, and, like, or, sql, inArray } from "drizzle-orm";
import { getDb } from "~/lib/db.server";
import { posts, users, categories, aiSummaries, aiDraftRequests, qaThreads, qaMessages } from "~/db/schema";
import { ulid } from "~/lib/ulid";
import { slugify, estimateReadingTime, generateExcerpt, htmlToText, generateGuideExcerpt } from "~/lib/utils";
import type { SessionUser } from "~/lib/auth.server";

// ─── Types ─────────────────────────────────────────────────
export interface CreatePostInput {
  /** Optional pre-generated ULID (used when R2 assets are stored before the row). */
  id?: string;
  title: string;
  content: string;
  excerpt?: string;
  categoryId?: string;
  tagsJson?: string;
  coverImageUrl?: string;
  metaTitle?: string;
  metaDescription?: string;
  visibility?: "public" | "limited";
  contentType?: PostContentType;
  assetPrefix?: string | null;
}

export type PostContentType = "article" | "case_guide";

/** Public URL of a post, depending on its content type. */
export function postPath(post: { slug: string; contentType?: string | null }): string {
  return post.contentType === "case_guide" ? `/cases/${post.slug}` : `/posts/${post.slug}`;
}

/** Excerpt / reading time derived from content, aware of the content type. */
function deriveFromContent(content: string, contentType: PostContentType) {
  if (contentType === "case_guide") {
    const text = htmlToText(content);
    return {
      excerpt: generateGuideExcerpt(content),
      metaDescription: generateGuideExcerpt(content, 120),
      readingTime: estimateReadingTime(text),
    };
  }
  return {
    excerpt: generateExcerpt(content),
    metaDescription: generateExcerpt(content, 120),
    readingTime: estimateReadingTime(content),
  };
}

export interface UpdatePostInput extends Partial<CreatePostInput> {
  status?: "draft" | "published";
  visibility?: "public" | "limited";
}

// ─── Queries ──────────────────────────────────────────────

export async function getPublishedPosts(
  db: D1Database,
  opts: {
    limit?: number;
    offset?: number;
    categorySlug?: string;
    search?: string;
    visibility?: "public" | "all";
    /** Defaults to "article" so existing article listings never include guides. */
    contentType?: PostContentType | "all";
  } = {}
) {
  const { limit = 20, offset = 0, categorySlug, search, visibility = "all", contentType = "article" } = opts;
  const d = getDb(db);

  const conditions = [eq(posts.status, "published")];

  if (contentType !== "all") {
    conditions.push(eq(posts.content_type, contentType));
  }

  if (visibility === "public") {
    conditions.push(eq(posts.visibility, "public"));
  }

  if (categorySlug) {
    const cat = await d.select().from(categories).where(eq(categories.slug, categorySlug)).get();
    if (cat) {
      conditions.push(eq(posts.category_id, cat.id));
    }
  }

  if (search) {
    conditions.push(
      or(
        like(posts.title, `%${search}%`),
        like(posts.content, `%${search}%`)
      )!
    );
  }

  const results = await d
    .select({
      id: posts.id,
      title: posts.title,
      slug: posts.slug,
      excerpt: posts.excerpt,
      coverImageUrl: posts.cover_image_url,
      authorId: posts.author_id,
      authorName: sql<string>`COALESCE(${users.nickname}, ${users.display_name}, ${posts.author_name_snapshot})`.as("author_name"),
      authorAvatar: users.avatar_url,
      categoryId: posts.category_id,
      categoryName: categories.name,
      categorySlug: categories.slug,
      tagsJson: posts.tags_json,
      readingTimeMinutes: posts.reading_time_minutes,
      viewCount: posts.view_count,
      visibility: posts.visibility,
      contentType: posts.content_type,
      publishedAt: posts.published_at,
    })
    .from(posts)
    .leftJoin(users, eq(posts.author_id, users.id))
    .leftJoin(categories, eq(posts.category_id, categories.id))
    .where(and(...conditions))
    .orderBy(desc(posts.published_at))
    .limit(limit)
    .offset(offset);

  return results;
}

export async function getPostBySlug(db: D1Database, slug: string) {
  const d = getDb(db);

  const result = await d
    .select({
      id: posts.id,
      title: posts.title,
      slug: posts.slug,
      content: posts.content,
      excerpt: posts.excerpt,
      coverImageUrl: posts.cover_image_url,
      authorId: posts.author_id,
      authorName: sql<string>`COALESCE(${users.nickname}, ${users.display_name}, ${posts.author_name_snapshot})`.as("author_name"),
      authorAvatar: users.avatar_url,
      authorCompany: users.company,
      authorExpertise: users.expertise,
      categoryId: posts.category_id,
      categoryName: categories.name,
      categorySlug: categories.slug,
      tagsJson: posts.tags_json,
      metaTitle: posts.meta_title,
      metaDescription: posts.meta_description,
      readingTimeMinutes: posts.reading_time_minutes,
      viewCount: posts.view_count,
      publishedAt: posts.published_at,
      createdAt: posts.created_at,
      updatedAt: posts.updated_at,
      visibility: posts.visibility,
      status: posts.status,
      contentType: posts.content_type,
      assetPrefix: posts.asset_prefix,
    })
    .from(posts)
    .leftJoin(users, eq(posts.author_id, users.id))
    .leftJoin(categories, eq(posts.category_id, categories.id))
    .where(eq(posts.slug, slug))
    .get();

  return result ?? null;
}

export async function getPostById(db: D1Database, id: string) {
  const d = getDb(db);
  return await d.select().from(posts).where(eq(posts.id, id)).get() ?? null;
}

export async function getUserPosts(
  db: D1Database,
  userId: string,
  statusFilter?: string
) {
  const d = getDb(db);

  const conditions = [eq(posts.author_id, userId)];
  if (statusFilter && statusFilter !== "all") {
    conditions.push(eq(posts.status, statusFilter as any));
  }

  return await d
    .select({
      id: posts.id,
      title: posts.title,
      slug: posts.slug,
      excerpt: posts.excerpt,
      visibility: posts.visibility,
      status: posts.status,
      contentType: posts.content_type,
      categoryName: categories.name,
      viewCount: posts.view_count,
      publishedAt: posts.published_at,
      createdAt: posts.created_at,
      updatedAt: posts.updated_at,
    })
    .from(posts)
    .leftJoin(categories, eq(posts.category_id, categories.id))
    .where(and(...conditions))
    .orderBy(desc(posts.updated_at));
}

export async function getAuthorPublicProfile(db: D1Database, authorId: string) {
  const d = getDb(db);

  const author = await d
    .select({
      id: users.id,
      displayName: sql<string>`COALESCE(${users.nickname}, ${users.display_name})`.as("display_name_resolved"),
      avatarUrl: users.avatar_url,
      bio: users.bio,
      company: users.company,
      jobRole: users.job_role,
      expertise: users.expertise,
      profileComment: users.profile_comment,
    })
    .from(users)
    .where(and(eq(users.id, authorId), eq(users.is_active, true)))
    .get();

  if (!author) return null;

  const authorPosts = await d
    .select({
      id: posts.id,
      title: posts.title,
      slug: posts.slug,
      excerpt: posts.excerpt,
      coverImageUrl: posts.cover_image_url,
      categoryName: categories.name,
      categorySlug: categories.slug,
      tagsJson: posts.tags_json,
      readingTimeMinutes: posts.reading_time_minutes,
      visibility: posts.visibility,
      contentType: posts.content_type,
      viewCount: posts.view_count,
      publishedAt: posts.published_at,
    })
    .from(posts)
    .leftJoin(categories, eq(posts.category_id, categories.id))
    .where(and(eq(posts.author_id, authorId), eq(posts.status, "published")))
    .orderBy(desc(posts.published_at));

  return { author, posts: authorPosts };
}

export async function getAllCategories(db: D1Database) {
  const d = getDb(db);
  return await d.select().from(categories).orderBy(categories.sort_order);
}

// ─── Mutations ────────────────────────────────────────────

export async function createPost(
  db: D1Database,
  input: CreatePostInput,
  user: SessionUser
) {
  const d = getDb(db);
  const id = input.id ?? ulid();
  const contentType = input.contentType ?? "article";
  const base = slugify(input.title) || (contentType === "case_guide" ? "guide" : "post");
  const slug = base + "-" + id.slice(-6).toLowerCase();
  const derived = deriveFromContent(input.content, contentType);

  const now = new Date().toISOString().replace("T", " ").slice(0, 19);

  await d.insert(posts).values({
    id,
    title: input.title,
    slug,
    content: input.content,
    excerpt: input.excerpt || derived.excerpt,
    cover_image_url: input.coverImageUrl,
    author_id: user.id,
    category_id: input.categoryId || null,
    status: "draft",
    visibility: input.visibility ?? "public",
    content_type: contentType,
    asset_prefix: input.assetPrefix ?? null,
    tags_json: input.tagsJson,
    meta_title: input.metaTitle || input.title,
    meta_description: input.metaDescription || derived.metaDescription,
    reading_time_minutes: derived.readingTime,
    created_at: now,
    updated_at: now,
  });

  return { id, slug };
}

export async function publishPost(db: D1Database, postId: string, user: SessionUser) {
  const d = getDb(db);
  const existing = await getPostById(db, postId);
  if (!existing) throw new Error("Post not found");
  if (existing.author_id !== user.id && user.role !== "admin") {
    throw new Error("Forbidden");
  }

  const now = new Date().toISOString().replace("T", " ").slice(0, 19);
  await d
    .update(posts)
    .set({
      status: "published",
      published_at: now,
      updated_at: now,
    })
    .where(eq(posts.id, postId));

  return { id: postId, slug: existing.slug, contentType: existing.content_type };
}

export async function updatePost(
  db: D1Database,
  postId: string,
  input: UpdatePostInput,
  user: SessionUser
) {
  const d = getDb(db);
  const existing = await getPostById(db, postId);
  if (!existing) throw new Error("Post not found");
  if (existing.author_id !== user.id && user.role !== "admin") {
    throw new Error("Forbidden");
  }

  const now = new Date().toISOString().replace("T", " ").slice(0, 19);
  const updateData: Record<string, any> = { updated_at: now };

  if (input.title !== undefined) {
    updateData.title = input.title;
    updateData.meta_title = input.metaTitle || input.title;
  }
  if (input.content !== undefined) {
    const derived = deriveFromContent(input.content, existing.content_type ?? "article");
    updateData.content = input.content;
    updateData.reading_time_minutes = derived.readingTime;
    updateData.excerpt =
      input.excerpt || (existing.content_type === "case_guide" ? derived.excerpt : input.content.slice(0, 200));
  }
  if (input.assetPrefix !== undefined) updateData.asset_prefix = input.assetPrefix;
  if (input.categoryId !== undefined) updateData.category_id = input.categoryId;
  if (input.tagsJson !== undefined) updateData.tags_json = input.tagsJson;
  if (input.coverImageUrl !== undefined) updateData.cover_image_url = input.coverImageUrl;
  if (input.metaDescription !== undefined) updateData.meta_description = input.metaDescription;
  if (input.status !== undefined) updateData.status = input.status;
  if (input.visibility !== undefined) updateData.visibility = input.visibility;

  await d.update(posts).set(updateData).where(eq(posts.id, postId));
  return { id: postId, slug: existing.slug };
}

export async function deletePost(db: D1Database, postId: string, user: SessionUser) {
  const d = getDb(db);
  const existing = await getPostById(db, postId);
  if (!existing) throw new Error("Post not found");
  if (existing.author_id !== user.id && user.role !== "admin") {
    throw new Error("Forbidden");
  }

  // Delete related records to satisfy foreign key constraints
  // 1. qa_messages (references qa_threads)
  const threads = await d
    .select({ id: qaThreads.id })
    .from(qaThreads)
    .where(eq(qaThreads.post_id, postId));
  if (threads.length > 0) {
    const threadIds = threads.map((t) => t.id);
    await d.delete(qaMessages).where(inArray(qaMessages.thread_id, threadIds));
  }
  // 2. qa_threads (references posts)
  await d.delete(qaThreads).where(eq(qaThreads.post_id, postId));
  // 3. ai_summaries (references posts)
  await d.delete(aiSummaries).where(eq(aiSummaries.post_id, postId));
  // 4. ai_draft_requests (references posts)
  await d.delete(aiDraftRequests).where(eq(aiDraftRequests.post_id, postId));
  // 5. Finally delete the post
  await d.delete(posts).where(eq(posts.id, postId));

  // Callers remove R2 assets of case guides using the returned prefix.
  return { success: true, assetPrefix: existing.asset_prefix ?? null };
}

// ─── Admin ────────────────────────────────────────────────

export async function getAllDraftPosts(db: D1Database) {
  const d = getDb(db);
  return await d
    .select({
      id: posts.id,
      title: posts.title,
      slug: posts.slug,
      content: posts.content,
      excerpt: posts.excerpt,
      authorId: posts.author_id,
      authorName: sql<string>`COALESCE(${users.nickname}, ${users.display_name}, ${posts.author_name_snapshot})`.as("author_name"),
      categoryName: categories.name,
      status: posts.status,
      createdAt: posts.created_at,
      updatedAt: posts.updated_at,
    })
    .from(posts)
    .leftJoin(users, eq(posts.author_id, users.id))
    .leftJoin(categories, eq(posts.category_id, categories.id))
    .where(eq(posts.status, "draft"))
    .orderBy(desc(posts.updated_at));
}

export async function getAllPostsForAdmin(db: D1Database) {
  const d = getDb(db);
  return await d
    .select({
      id: posts.id,
      title: posts.title,
      slug: posts.slug,
      excerpt: posts.excerpt,
      authorId: posts.author_id,
      authorName: sql<string>`COALESCE(${users.nickname}, ${users.display_name}, ${posts.author_name_snapshot})`.as("author_name"),
      categoryName: categories.name,
      visibility: posts.visibility,
      status: posts.status,
      viewCount: posts.view_count,
      publishedAt: posts.published_at,
      createdAt: posts.created_at,
      updatedAt: posts.updated_at,
    })
    .from(posts)
    .leftJoin(users, eq(posts.author_id, users.id))
    .leftJoin(categories, eq(posts.category_id, categories.id))
    .orderBy(desc(posts.updated_at));
}

// ─── User management (admin) ──────────────────────────────

export async function ensureUser(db: D1Database, user: SessionUser) {
  const d = getDb(db);

  // 1. Lookup by ID
  const existing = await d.select().from(users).where(eq(users.id, user.id)).get();
  if (existing) return existing;

  // 2. Fallback: lookup by email (handles ID mismatch, e.g. access-request approval vs Access JWT)
  const byEmail = await d.select().from(users).where(eq(users.email, user.email)).get();
  if (byEmail) {
    // Update the ID to match the current Access identity so future lookups work by ID
    const now = new Date().toISOString().replace("T", " ").slice(0, 19);
    await d.update(users).set({ id: user.id, updated_at: now }).where(eq(users.email, user.email));
    return await d.select().from(users).where(eq(users.id, user.id)).get();
  }

  // 3. New user — insert
  const now = new Date().toISOString().replace("T", " ").slice(0, 19);
  await d.insert(users).values({
    id: user.id,
    email: user.email,
    display_name: user.displayName,
    avatar_url: user.avatarUrl || null,
    role: user.role,
    created_at: now,
    updated_at: now,
  });

  return await d.select().from(users).where(eq(users.id, user.id)).get();
}

export async function getPostSummary(db: D1Database, postId: string) {
  const d = getDb(db);
  return await d
    .select({
      summary: aiSummaries.summary,
      keyPointsJson: aiSummaries.key_points_json,
    })
    .from(aiSummaries)
    .where(eq(aiSummaries.post_id, postId))
    .orderBy(sql`${aiSummaries.created_at} DESC`)
    .get();
}

export async function incrementViewCount(db: D1Database, postId: string) {
  const d = getDb(db);
  await d
    .update(posts)
    .set({ view_count: sql`view_count + 1` })
    .where(eq(posts.id, postId));
}
