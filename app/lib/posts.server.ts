import { eq, desc, and, like, or, sql } from "drizzle-orm";
import { getDb } from "~/lib/db.server";
import { posts, users, categories, aiSummaries } from "~/db/schema";
import { ulid } from "~/lib/ulid";
import { slugify, estimateReadingTime } from "~/lib/utils";
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
  status?: "draft" | "pending_review";
}

// ─── Auto-approval threshold ──────────────────────────────
const AUTO_APPROVE_THRESHOLD = 3;

function shouldAutoApprove(user: SessionUser, approvedCount: number): boolean {
  if (user.role === "admin") return true;
  if (user.role === "se" && approvedCount >= AUTO_APPROVE_THRESHOLD) return true;
  return false;
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
      authorName: users.display_name,
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
      authorName: users.display_name,
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

  // Check auto-approval
  const dbUser = await d.select().from(users).where(eq(users.id, user.id)).get();
  const approvedCount = dbUser?.approved_post_count ?? 0;
  const autoApproved = shouldAutoApprove(user, approvedCount);

  const now = new Date().toISOString().replace("T", " ").slice(0, 19);

  await d.insert(posts).values({
    id,
    title: input.title,
    slug,
    content: input.content,
    excerpt: input.excerpt || input.content.slice(0, 200),
    cover_image_url: input.coverImageUrl,
    author_id: user.id,
    category_id: input.categoryId || null,
    status: autoApproved ? "published" : "pending_review",
    auto_approved: autoApproved,
    tags_json: input.tagsJson,
    meta_title: input.metaTitle || input.title,
    meta_description: input.metaDescription || input.content.slice(0, 160),
    reading_time_minutes: readingTime,
    published_at: autoApproved ? now : null,
    created_at: now,
    updated_at: now,
  });

  // If auto-approved, increment the user's approved count
  if (autoApproved && dbUser) {
    await d
      .update(users)
      .set({ approved_post_count: approvedCount + 1, updated_at: now })
      .where(eq(users.id, user.id));
  }

  return { id, slug, autoApproved };
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

  await d.delete(posts).where(eq(posts.id, postId));
  return { success: true };
}

// ─── Admin ────────────────────────────────────────────────

export async function getPendingPosts(db: D1Database) {
  const d = getDb(db);
  return await d
    .select({
      id: posts.id,
      title: posts.title,
      slug: posts.slug,
      excerpt: posts.excerpt,
      authorId: posts.author_id,
      authorName: users.display_name,
      categoryName: categories.name,
      status: posts.status,
      createdAt: posts.created_at,
    })
    .from(posts)
    .leftJoin(users, eq(posts.author_id, users.id))
    .leftJoin(categories, eq(posts.category_id, categories.id))
    .where(eq(posts.status, "pending_review"))
    .orderBy(posts.created_at);
}

export async function approvePost(db: D1Database, postId: string, reviewerId: string) {
  const d = getDb(db);
  const now = new Date().toISOString().replace("T", " ").slice(0, 19);

  const post = await getPostById(db, postId);
  if (!post) throw new Error("Post not found");

  await d
    .update(posts)
    .set({
      status: "published",
      published_at: now,
      reviewed_by: reviewerId,
      reviewed_at: now,
      updated_at: now,
    })
    .where(eq(posts.id, postId));

  // Increment author's approved count
  const author = await d.select().from(users).where(eq(users.id, post.author_id)).get();
  if (author) {
    await d
      .update(users)
      .set({
        approved_post_count: (author.approved_post_count ?? 0) + 1,
        updated_at: now,
      })
      .where(eq(users.id, post.author_id));
  }

  return { success: true };
}

export async function rejectPost(db: D1Database, postId: string, reviewerId: string) {
  const d = getDb(db);
  const now = new Date().toISOString().replace("T", " ").slice(0, 19);

  await d
    .update(posts)
    .set({
      status: "rejected",
      reviewed_by: reviewerId,
      reviewed_at: now,
      updated_at: now,
    })
    .where(eq(posts.id, postId));

  return { success: true };
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
