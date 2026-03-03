import { json, type ActionFunctionArgs } from "@remix-run/cloudflare";
import { requireRole } from "~/lib/auth.server";
import { generateTrendReport } from "~/lib/ai.server";
import { getDb } from "~/lib/db.server";
import { posts, categories } from "~/db/schema";
import { eq, desc, and, gte } from "drizzle-orm";

export async function action({ request, context }: ActionFunctionArgs) {
  await requireRole(request, ["admin", "se"]);

  if (request.method !== "POST") {
    return json({ error: "Method not allowed" }, { status: 405 });
  }

  const db = context.cloudflare.env.DB;
  const ai = context.cloudflare.env.AI;
  const d = getDb(db);

  // Get posts published in the last 30 days
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
    return json({ error: "直近30日間に公開された記事がありません" }, { status: 400 });
  }

  const articles = recentPosts.map((p) => ({
    title: p.title,
    category: p.categoryName ?? "General",
    tags: p.tagsJson ? JSON.parse(p.tagsJson).join(", ") : "",
    publishedAt: p.publishedAt ?? "",
  }));

  const report = await generateTrendReport(ai, articles);
  if (!report) {
    return json({ error: "レポート生成に失敗しました" }, { status: 500 });
  }

  // Save to KV for caching
  const cache = context.cloudflare.env.PAGE_CACHE;
  const cacheKey = "trend-report:latest";
  await cache.put(
    cacheKey,
    JSON.stringify({ ...report, generatedAt: new Date().toISOString(), articleCount: recentPosts.length }),
    { expirationTtl: 86400 } // 24 hours
  );

  return json({ report, articleCount: recentPosts.length });
}
