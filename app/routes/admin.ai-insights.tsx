import type {
  ActionFunctionArgs,
  LoaderFunctionArgs,
  MetaFunction,
} from "@remix-run/cloudflare";
import { useLoaderData, useActionData, Link, Form, useNavigation } from "@remix-run/react";
import { requireRole } from "~/lib/auth.server";
import { getDb } from "~/lib/db.server";
import { generateTrendReport } from "~/lib/ai.server";
import { aiSummaries, aiDraftRequests, posts, categories } from "~/db/schema";
import { sql, desc, eq, count, and, gte } from "drizzle-orm";

export const meta: MetaFunction = () => [
  { title: "AI インサイト — Cloudflare Solution Blog" },
];

export async function loader({ request, context }: LoaderFunctionArgs) {
  const user = await requireRole(request, ["admin", "se"]);
  const db = context.cloudflare.env.DB;
  const d = getDb(db);
  const cache = context.cloudflare.env.PAGE_CACHE;

  // AI summary stats
  const summaryStats = await d
    .select({ total: count() })
    .from(aiSummaries)
    .get();

  // AI draft stats
  const draftStats = await d
    .select({
      total: count(),
      completed: sql<number>`SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END)`,
      failed: sql<number>`SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END)`,
    })
    .from(aiDraftRequests)
    .get();

  // Recent AI summaries
  const recentSummaries = await d
    .select({
      id: aiSummaries.id,
      postId: aiSummaries.post_id,
      postTitle: posts.title,
      summary: aiSummaries.summary,
      modelUsed: aiSummaries.model_used,
      createdAt: aiSummaries.created_at,
    })
    .from(aiSummaries)
    .leftJoin(posts, eq(aiSummaries.post_id, posts.id))
    .orderBy(desc(aiSummaries.created_at))
    .limit(10);

  // Recent AI drafts
  const recentDrafts = await d
    .select({
      id: aiDraftRequests.id,
      templateId: aiDraftRequests.template_id,
      modelUsed: aiDraftRequests.model_used,
      tokensUsed: aiDraftRequests.tokens_used,
      latencyMs: aiDraftRequests.latency_ms,
      status: aiDraftRequests.status,
      createdAt: aiDraftRequests.created_at,
    })
    .from(aiDraftRequests)
    .orderBy(desc(aiDraftRequests.created_at))
    .limit(10);

  // Cached trend report
  let trendReport: any = null;
  try {
    const cached = await cache.get("trend-report:latest");
    if (cached) trendReport = JSON.parse(cached);
  } catch { /* ignore */ }

  return {
    user,
    summaryCount: summaryStats?.total ?? 0,
    draftTotal: draftStats?.total ?? 0,
    draftCompleted: draftStats?.completed ?? 0,
    draftFailed: draftStats?.failed ?? 0,
    recentSummaries,
    recentDrafts,
    trendReport,
  };
}

export async function action({ request, context }: ActionFunctionArgs) {
  await requireRole(request, ["admin", "se"]);

  const formData = await request.formData();
  const intent = formData.get("intent") as string;

  if (intent === "generate-trend") {
    const db = context.cloudflare.env.DB;
    const ai = context.cloudflare.env.AI;
    const cache = context.cloudflare.env.PAGE_CACHE;
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
      return { error: "直近30日間に公開された記事がありません" };
    }

    const articles = recentPosts.map((p) => ({
      title: p.title,
      category: p.categoryName ?? "General",
      tags: p.tagsJson ? JSON.parse(p.tagsJson).join(", ") : "",
      publishedAt: p.publishedAt ?? "",
    }));

    const report = await generateTrendReport(ai, articles);
    if (!report) {
      return { error: "レポート生成に失敗しました" };
    }

    // Save to KV for caching
    const cacheData = {
      ...report,
      generatedAt: new Date().toISOString(),
      articleCount: recentPosts.length,
    };
    await cache.put("trend-report:latest", JSON.stringify(cacheData), {
      expirationTtl: 86400,
    });

    return { report: cacheData };
  }

  return { error: "Unknown action" };
}

export default function AIInsights() {
  const {
    user,
    summaryCount,
    draftTotal,
    draftCompleted,
    draftFailed,
    recentSummaries,
    recentDrafts,
    trendReport,
  } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const isGenerating = navigation.state === "submitting";

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="border-b bg-white">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-4">
            <Link to="/" className="text-lg font-bold text-gray-900 hover:text-brand-600 transition-colors">
              Cloudflare Solution Blog
            </Link>
            <span className="text-sm text-gray-400">|</span>
            <span className="text-sm font-semibold text-red-600">Admin</span>
            <span className="text-sm text-gray-400">|</span>
            <nav className="flex items-center gap-4 text-sm">
              <Link to="/admin" className="text-gray-500 hover:text-gray-700">
                投稿管理
              </Link>
              <Link to="/admin/access-requests" className="text-gray-500 hover:text-gray-700">
                投稿者申請
              </Link>
              <Link to="/admin/users" className="text-gray-500 hover:text-gray-700">
                ユーザー管理
              </Link>
              <Link to="/admin/ai-insights" className="font-medium text-brand-600">
                AI インサイト
              </Link>
              <Link to="/admin/qa" className="text-gray-500 hover:text-gray-700">
                Q&A 管理
              </Link>
              <Link to="/admin/presentation" className="text-gray-500 hover:text-gray-700">
                プレゼン
              </Link>
              <Link to="/admin/template-api" className="text-gray-500 hover:text-gray-700">
                Template API
              </Link>
              <Link to="/portal" className="text-gray-500 hover:text-gray-700">
                ポータル
              </Link>
            </nav>
          </div>
          <span className="text-sm text-gray-500">{user.displayName}</span>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <h1 className="mb-6 text-2xl font-bold text-gray-900">AI インサイト</h1>

        {/* Stats */}
        <div className="mb-8 grid gap-4 sm:grid-cols-4">
          <div className="rounded-xl border bg-white p-5">
            <div className="text-xs font-semibold uppercase tracking-widest text-gray-400">
              AI サマリー生成数
            </div>
            <div className="mt-2 text-3xl font-bold text-gray-900">{summaryCount}</div>
          </div>
          <div className="rounded-xl border bg-white p-5">
            <div className="text-xs font-semibold uppercase tracking-widest text-gray-400">
              AI 下書き生成数
            </div>
            <div className="mt-2 text-3xl font-bold text-gray-900">{draftTotal}</div>
          </div>
          <div className="rounded-xl border bg-white p-5">
            <div className="text-xs font-semibold uppercase tracking-widest text-gray-400">
              下書き成功率
            </div>
            <div className="mt-2 text-3xl font-bold text-green-600">
              {draftTotal > 0 ? Math.round((draftCompleted / draftTotal) * 100) : 0}%
            </div>
          </div>
          <div className="rounded-xl border bg-white p-5">
            <div className="text-xs font-semibold uppercase tracking-widest text-gray-400">
              下書き失敗数
            </div>
            <div className="mt-2 text-3xl font-bold text-red-600">{draftFailed}</div>
          </div>
        </div>

        {/* Trend Report */}
        <div className="mb-8 rounded-xl border bg-white p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-bold text-gray-900">トレンドレポート</h2>
            <Form method="post">
              <input type="hidden" name="intent" value="generate-trend" />
              <button
                type="submit"
                disabled={isGenerating}
                className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600 transition-colors disabled:opacity-50"
              >
                {isGenerating ? "生成中..." : "最新レポートを生成"}
              </button>
            </Form>
          </div>

          {actionData && "error" in actionData && (
            <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {(actionData as any).error}
            </div>
          )}

          {trendReport ? (
            <div className="space-y-4">
              <div className="flex items-center gap-3 text-xs text-gray-400">
                <span>対象期間: {trendReport.period}</span>
                <span>記事数: {trendReport.articleCount}</span>
                {trendReport.generatedAt && (
                  <span>
                    生成日時: {new Date(trendReport.generatedAt).toLocaleString("ja-JP")}
                  </span>
                )}
              </div>
              <p className="text-sm leading-relaxed text-gray-700">
                {trendReport.summary}
              </p>
              <div className="grid gap-4 sm:grid-cols-3">
                <div>
                  <div className="mb-2 text-xs font-semibold uppercase tracking-widest text-gray-400">
                    トレンドトピック
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {trendReport.trendingTopics?.map((t: string, i: number) => (
                      <span
                        key={i}
                        className="rounded-full bg-brand-100 px-2.5 py-0.5 text-xs font-medium text-brand-700"
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                </div>
                <div>
                  <div className="mb-2 text-xs font-semibold uppercase tracking-widest text-gray-400">
                    人気サービス
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {trendReport.popularServices?.map((s: string, i: number) => (
                      <span
                        key={i}
                        className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-700"
                      >
                        {s}
                      </span>
                    ))}
                  </div>
                </div>
                <div>
                  <div className="mb-2 text-xs font-semibold uppercase tracking-widest text-gray-400">
                    次に書くべきトピック
                  </div>
                  <ul className="space-y-1">
                    {trendReport.recommendations?.map((r: string, i: number) => (
                      <li key={i} className="flex items-start gap-2 text-xs text-gray-600">
                        <span className="mt-1 h-1 w-1 flex-shrink-0 rounded-full bg-brand-400" />
                        {r}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          ) : (
            <p className="text-sm text-gray-400">
              まだトレンドレポートがありません。「最新レポートを生成」をクリックしてください。
            </p>
          )}
        </div>

        {/* Recent AI Summaries */}
        <div className="mb-8">
          <h2 className="mb-4 text-lg font-bold text-gray-900">最近の AI サマリー</h2>
          {recentSummaries.length > 0 ? (
            <div className="overflow-hidden rounded-xl border bg-white">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                      記事
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                      サマリー
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                      生成日時
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {recentSummaries.map((s) => (
                    <tr key={s.id}>
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">
                        {s.postTitle ?? s.postId}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500 max-w-xs truncate">
                        {s.summary.slice(0, 80)}...
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-400 whitespace-nowrap">
                        {s.createdAt}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-gray-400">まだ AI サマリーがありません</p>
          )}
        </div>

        {/* Recent AI Drafts */}
        <div>
          <h2 className="mb-4 text-lg font-bold text-gray-900">最近の AI 下書き生成</h2>
          {recentDrafts.length > 0 ? (
            <div className="overflow-hidden rounded-xl border bg-white">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                      テンプレート
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                      モデル
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                      トークン
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                      レイテンシ
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                      ステータス
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                      日時
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {recentDrafts.map((d) => (
                    <tr key={d.id}>
                      <td className="px-4 py-3 text-sm text-gray-900">
                        {d.templateId ?? "-"}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500">
                        {d.modelUsed ?? "-"}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500">
                        {d.tokensUsed ?? "-"}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500">
                        {d.latencyMs ? `${d.latencyMs}ms` : "-"}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                            d.status === "completed"
                              ? "bg-green-100 text-green-700"
                              : d.status === "failed"
                                ? "bg-red-100 text-red-700"
                                : "bg-yellow-100 text-yellow-700"
                          }`}
                        >
                          {d.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-400 whitespace-nowrap">
                        {d.createdAt}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-gray-400">まだ AI 下書きがありません</p>
          )}
        </div>
      </main>
    </div>
  );
}
