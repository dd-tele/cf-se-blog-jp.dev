import { Hono } from "hono";
import type { HonoEnv } from "../types";
import { requireAuth, requireRole } from "../middleware";
import { suggestTags, improveText, generateTrendReport } from "~/lib/ai.server";
import { getDb } from "~/lib/db.server";
import { posts, categories } from "~/db/schema";
import { eq, desc, and, gte } from "drizzle-orm";

const ai = new Hono<HonoEnv>();

// POST /api/v1/ai/suggest-tags
ai.post("/suggest-tags", requireAuth, async (c) => {
  const body = await c.req.json<{ content?: string }>();
  if (!body.content) {
    return c.json({ error: "content is required" }, 400);
  }
  const tags = await suggestTags(c.env.AI, body.content);
  return c.json({ tags });
});

// POST /api/v1/ai/improve
ai.post("/improve", requireAuth, async (c) => {
  const body = await c.req.json<{ text?: string }>();
  if (!body.text) {
    return c.json({ error: "text is required" }, 400);
  }
  const improved = await improveText(c.env.AI, body.text);
  return c.json({ improved });
});

// POST /api/v1/ai/trend-report
ai.post("/trend-report", requireRole("admin", "se"), async (c) => {
  const db = c.env.DB;
  const d = getDb(db);

  // Posts published in the last 30 days
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    .toISOString()
    .replace("T", " ")
    .slice(0, 19);

  const recentPosts = await d
    .select({
      title: posts.title,
      categoryName: categories.name,
      tagsJson: posts.tags_json,
      publishedAt: posts.published_at,
    })
    .from(posts)
    .leftJoin(categories, eq(posts.category_id, categories.id))
    .where(
      and(
        eq(posts.status, "published"),
        gte(posts.published_at, thirtyDaysAgo)
      )
    )
    .orderBy(desc(posts.published_at))
    .limit(50);

  if (recentPosts.length === 0) {
    return c.json({ error: "直近30日間に公開された記事がありません" }, 400);
  }

  const articles = recentPosts.map((p) => ({
    title: p.title,
    category: p.categoryName ?? "General",
    tags: p.tagsJson ? JSON.parse(p.tagsJson).join(", ") : "",
    publishedAt: p.publishedAt ?? "",
  }));

  const report = await generateTrendReport(c.env.AI, articles);
  if (!report) {
    return c.json({ error: "レポート生成に失敗しました" }, 500);
  }

  // Cache to KV
  const cache = c.env.PAGE_CACHE;
  await cache.put(
    "trend-report:latest",
    JSON.stringify({
      ...report,
      generatedAt: new Date().toISOString(),
      articleCount: recentPosts.length,
    }),
    { expirationTtl: 86400 }
  );

  return c.json({ report, articleCount: recentPosts.length });
});

export default ai;
