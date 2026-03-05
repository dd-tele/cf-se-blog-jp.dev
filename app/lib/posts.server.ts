import { eq, desc, and, like, or, sql, inArray } from "drizzle-orm";
import { getDb } from "~/lib/db.server";
import { posts, users, categories, aiSummaries, aiDraftRequests, qaThreads, qaMessages } from "~/db/schema";
import { ulid } from "~/lib/ulid";
import { slugify, estimateReadingTime, generateExcerpt } from "~/lib/utils";
import type { SessionUser } from "~/lib/auth.server";

// ─── Types ─────────────────────────────────────────────────
export interface CreatePostInput {
  title: string;
  content: string;
  excerpt?: string;
  categoryId?: string;
  tagsJson?: string;
  coverImageUrl?: string;
  metaTitle?: string;
  metaDescription?: string;
}

export interface UpdatePostInput extends Partial<CreatePostInput> {
  status?: "draft" | "published";
}

// ─── Queries ──────────────────────────────────────────────

export async function getPublishedPosts(
  db: D1Database,
  opts: { limit?: number; offset?: number; categorySlug?: string; search?: string } = {}
) {
  const { limit = 20, offset = 0, categorySlug, search } = opts;
  const d = getDb(db);

  const conditions = [eq(posts.status, "published")];

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
      authorBio: users.bio,
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
      status: posts.status,
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
      status: posts.status,
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
  const id = ulid();
  const slug = slugify(input.title) + "-" + id.slice(-6).toLowerCase();
  const readingTime = estimateReadingTime(input.content);

  const now = new Date().toISOString().replace("T", " ").slice(0, 19);

  await d.insert(posts).values({
    id,
    title: input.title,
    slug,
    content: input.content,
    excerpt: input.excerpt || generateExcerpt(input.content),
    cover_image_url: input.coverImageUrl,
    author_id: user.id,
    category_id: input.categoryId || null,
    status: "draft",
    tags_json: input.tagsJson,
    meta_title: input.metaTitle || input.title,
    meta_description: input.metaDescription || generateExcerpt(input.content, 120),
    reading_time_minutes: readingTime,
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

  return { id: postId, slug: existing.slug };
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
    updateData.content = input.content;
    updateData.reading_time_minutes = estimateReadingTime(input.content);
    updateData.excerpt = input.excerpt || input.content.slice(0, 200);
  }
  if (input.categoryId !== undefined) updateData.category_id = input.categoryId;
  if (input.tagsJson !== undefined) updateData.tags_json = input.tagsJson;
  if (input.coverImageUrl !== undefined) updateData.cover_image_url = input.coverImageUrl;
  if (input.metaDescription !== undefined) updateData.meta_description = input.metaDescription;
  if (input.status !== undefined) updateData.status = input.status;

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

  return { success: true };
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
  const existing = await d.select().from(users).where(eq(users.id, user.id)).get();
  if (existing) return existing;

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
