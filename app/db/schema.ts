import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

// ─── Users ─────────────────────────────────────────────────
export const users = sqliteTable("users", {
  id: text("id").primaryKey(), // ULID
  email: text("email").notNull().unique(),
  display_name: text("display_name").notNull(),
  password_hash: text("password_hash"),
  avatar_url: text("avatar_url"),
  role: text("role", { enum: ["admin", "se", "user"] })
    .notNull()
    .default("user"),
  bio: text("bio"),
  social_links_json: text("social_links_json"), // JSON string
  nickname: text("nickname"),
  furigana: text("furigana"),
  company: text("company"),
  job_role: text("job_role"),
  expertise: text("expertise"),
  profile_comment: text("profile_comment"),
  approved_post_count: integer("approved_post_count").notNull().default(0),
  is_active: integer("is_active", { mode: "boolean" }).notNull().default(true),
  created_at: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
  updated_at: text("updated_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});

// ─── Access Requests ──────────────────────────────────────
export const accessRequests = sqliteTable("access_requests", {
  id: text("id").primaryKey(),
  email: text("email").notNull(),
  display_name: text("display_name").notNull(),
  nickname: text("nickname"),
  furigana: text("furigana"),
  company: text("company"),
  job_role: text("job_role"),
  expertise: text("expertise"),
  profile_comment: text("profile_comment"),
  status: text("status", { enum: ["pending", "approved", "rejected"] })
    .notNull()
    .default("pending"),
  reviewed_by: text("reviewed_by").references(() => users.id),
  reviewed_at: text("reviewed_at"),
  admin_note: text("admin_note"),
  created_at: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
  updated_at: text("updated_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});

// ─── Categories ────────────────────────────────────────────
export const categories = sqliteTable("categories", {
  id: text("id").primaryKey(),
  name: text("name").notNull().unique(),
  slug: text("slug").notNull().unique(),
  description: text("description"),
  icon: text("icon"),
  sort_order: integer("sort_order").notNull().default(0),
  created_at: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});

// ─── Posts ─────────────────────────────────────────────────
export const posts = sqliteTable("posts", {
  id: text("id").primaryKey(), // ULID
  title: text("title").notNull(),
  slug: text("slug").notNull().unique(),
  content: text("content").notNull(),
  excerpt: text("excerpt"),
  cover_image_url: text("cover_image_url"),
  author_id: text("author_id")
    .notNull()
    .references(() => users.id),
  category_id: text("category_id").references(() => categories.id),
  status: text("status", {
    enum: ["draft", "pending_review", "published", "rejected", "archived"],
  })
    .notNull()
    .default("draft"),
  auto_approved: integer("auto_approved", { mode: "boolean" })
    .notNull()
    .default(false),
  tags_json: text("tags_json"), // JSON array string
  meta_title: text("meta_title"),
  meta_description: text("meta_description"),
  reading_time_minutes: integer("reading_time_minutes"),
  view_count: integer("view_count").notNull().default(0),
  published_at: text("published_at"),
  author_name_snapshot: text("author_name_snapshot"),
  reviewed_by: text("reviewed_by").references(() => users.id),
  reviewed_at: text("reviewed_at"),
  created_at: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
  updated_at: text("updated_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});

// ─── Templates ─────────────────────────────────────────────
export const templates = sqliteTable("templates", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  category_id: text("category_id").references(() => categories.id),
  difficulty: text("difficulty", { enum: ["beginner", "intermediate", "advanced"] })
    .notNull()
    .default("beginner"),
  estimated_minutes: integer("estimated_minutes").notNull().default(30),
  input_fields_json: text("input_fields_json").notNull(), // JSON: structured input field definitions
  ai_prompt_template: text("ai_prompt_template").notNull(), // AI prompt template with {{placeholders}}
  is_active: integer("is_active", { mode: "boolean" }).notNull().default(true),
  sort_order: integer("sort_order").notNull().default(0),
  created_at: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
  updated_at: text("updated_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});

// ─── AI Draft Requests ─────────────────────────────────────
export const aiDraftRequests = sqliteTable("ai_draft_requests", {
  id: text("id").primaryKey(),
  user_id: text("user_id")
    .notNull()
    .references(() => users.id),
  template_id: text("template_id").references(() => templates.id),
  post_id: text("post_id").references(() => posts.id),
  input_data_json: text("input_data_json").notNull(), // JSON: user inputs
  generated_content: text("generated_content"),
  model_used: text("model_used"),
  tokens_used: integer("tokens_used"),
  latency_ms: integer("latency_ms"),
  status: text("status", { enum: ["pending", "completed", "failed"] })
    .notNull()
    .default("pending"),
  created_at: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});

// ─── AI Summaries ──────────────────────────────────────────
export const aiSummaries = sqliteTable("ai_summaries", {
  id: text("id").primaryKey(),
  post_id: text("post_id")
    .notNull()
    .references(() => posts.id),
  summary: text("summary").notNull(),
  key_points_json: text("key_points_json"),
  model_used: text("model_used"),
  created_at: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});

// ─── Q&A Threads ───────────────────────────────────────────
export const qaThreads = sqliteTable("qa_threads", {
  id: text("id").primaryKey(),
  post_id: text("post_id")
    .notNull()
    .references(() => posts.id),
  status: text("status", { enum: ["active", "resolved", "flagged"] })
    .notNull()
    .default("active"),
  message_count: integer("message_count").notNull().default(0),
  created_at: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
  updated_at: text("updated_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});

// ─── Q&A Messages ──────────────────────────────────────────
export const qaMessages = sqliteTable("qa_messages", {
  id: text("id").primaryKey(),
  thread_id: text("thread_id")
    .notNull()
    .references(() => qaThreads.id),
  role: text("role", { enum: ["user", "ai", "se", "admin", "system"] }).notNull(),
  content: text("content").notNull(),
  user_id: text("user_id").references(() => users.id),
  metadata_json: text("metadata_json"),
  flagged: integer("flagged", { mode: "boolean" }).notNull().default(false),
  created_at: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});

// ─── User Badges ──────────────────────────────────────────
export const userBadges = sqliteTable("user_badges", {
  id: text("id").primaryKey(),
  user_id: text("user_id")
    .notNull()
    .references(() => users.id),
  badge_type: text("badge_type").notNull(),
  badge_name: text("badge_name").notNull(),
  badge_description: text("badge_description"),
  badge_icon: text("badge_icon"),
  earned_at: text("earned_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});

// ─── Notification Settings ────────────────────────────────
export const notificationSettings = sqliteTable("notification_settings", {
  user_id: text("user_id")
    .primaryKey()
    .references(() => users.id),
  email_on_approval: integer("email_on_approval", { mode: "boolean" })
    .notNull()
    .default(true),
  email_on_rejection: integer("email_on_rejection", { mode: "boolean" })
    .notNull()
    .default(true),
  email_on_qa_reply: integer("email_on_qa_reply", { mode: "boolean" })
    .notNull()
    .default(true),
  updated_at: text("updated_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});

// ─── Audit Logs ────────────────────────────────────────────
export const auditLogs = sqliteTable("audit_logs", {
  id: text("id").primaryKey(),
  user_id: text("user_id").references(() => users.id),
  action: text("action").notNull(),
  resource_type: text("resource_type").notNull(),
  resource_id: text("resource_id"),
  details_json: text("details_json"),
  ip_address: text("ip_address"),
  created_at: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});
