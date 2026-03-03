import type { LoaderFunctionArgs, MetaFunction } from "@remix-run/cloudflare";
import { useLoaderData, Link, Form, useSearchParams } from "@remix-run/react";
import { getSessionUser } from "~/lib/auth.server";
import { semanticSearch } from "~/lib/vectorize.server";
import { getPublishedPosts } from "~/lib/posts.server";

export const meta: MetaFunction = () => [
  { title: "検索 — Cloudflare Solution Blog" },
];

export async function loader({ request, context }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const query = url.searchParams.get("q")?.trim() ?? "";
  const mode = url.searchParams.get("mode") ?? "keyword";
  const user = await getSessionUser(request);
  const db = context.cloudflare.env.DB;
  const ai = context.cloudflare.env.AI;
  const vectorize = context.cloudflare.env.VECTORIZE;

  let posts: {
    id: string;
    title: string;
    slug: string;
    excerpt: string | null;
    authorName: string;
    categoryName: string | null;
    publishedAt: string | null;
    score?: number;
  }[] = [];

  let semanticAvailable = !!vectorize;

  if (query) {
    if (mode === "semantic" && vectorize && ai) {
      // Semantic search via Vectorize
      const results = await semanticSearch(ai, vectorize, query, 20);
      if (results.length > 0) {
        // Fetch post details from D1 for matched IDs
        const allPosts = await getPublishedPosts(db, {
          limit: 200,
          offset: 0,
        });
        const matchMap = new Map(results.map((r) => [r.id, r.score]));
        posts = allPosts
          .filter((p: { id: string }) => matchMap.has(p.id))
          .map((p: { id: string; title: string; slug: string; excerpt: string | null; authorName: string | null; categoryName: string | null; publishedAt: string | null }) => ({
            id: p.id,
            title: p.title,
            slug: p.slug,
            excerpt: p.excerpt,
            authorName: p.authorName ?? "",
            categoryName: p.categoryName,
            publishedAt: p.publishedAt,
            score: matchMap.get(p.id),
          }))
          .sort((a: { score?: number }, b: { score?: number }) => (b.score ?? 0) - (a.score ?? 0));
      }
    } else {
      // Keyword search via D1
      const keywordPosts = await getPublishedPosts(db, {
        search: query,
        limit: 20,
        offset: 0,
      });
      posts = keywordPosts.map((p: { id: string; title: string; slug: string; excerpt: string | null; authorName: string | null; categoryName: string | null; publishedAt: string | null }) => ({
        id: p.id,
        title: p.title,
        slug: p.slug,
        excerpt: p.excerpt,
        authorName: p.authorName ?? "",
        categoryName: p.categoryName,
        publishedAt: p.publishedAt,
      }));
    }
  }

  return {
    query,
    mode,
    posts,
    semanticAvailable,
    user,
    siteName: context.cloudflare.env.SITE_NAME ?? "Cloudflare Solution Blog",
  };
}

export default function SearchPage() {
  const { query, mode, posts, semanticAvailable, user, siteName } =
    useLoaderData<typeof loader>();
  const [searchParams] = useSearchParams();

  return (
    <div className="flex min-h-screen flex-col">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b bg-white/80 backdrop-blur-sm">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link
            to="/"
            className="text-lg font-bold text-gray-900 hover:text-brand-600 transition-colors"
          >
            {siteName}
          </Link>
          <nav className="flex items-center gap-4">
            <Link to="/posts" className="text-sm text-gray-600 hover:text-gray-900">
              記事一覧
            </Link>
            {user ? (
              <Link
                to="/portal"
                className="text-sm font-medium text-gray-600 hover:text-gray-900"
              >
                ダッシュボード
              </Link>
            ) : (
              <a
                href="/portal"
                className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600 transition-colors"
              >
                ログイン
              </a>
            )}
          </nav>
        </div>
      </header>

      <main className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
        <h1 className="mb-6 text-2xl font-bold text-gray-900">検索</h1>

        {/* Search form */}
        <Form method="get" className="mb-8">
          <div className="flex gap-3">
            <input
              type="text"
              name="q"
              defaultValue={query}
              placeholder="キーワードや質問を入力..."
              className="flex-1 rounded-lg border border-gray-300 px-4 py-3 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
            <button
              type="submit"
              className="rounded-lg bg-gray-900 px-6 py-3 text-sm font-medium text-white hover:bg-gray-800 transition-colors"
            >
              検索
            </button>
          </div>

          {/* Search mode toggle */}
          <div className="mt-3 flex items-center gap-4">
            <label className="flex items-center gap-2 text-sm text-gray-600">
              <input
                type="radio"
                name="mode"
                value="keyword"
                defaultChecked={mode === "keyword"}
                className="text-brand-600 focus:ring-brand-500"
              />
              キーワード検索
            </label>
            <label
              className={`flex items-center gap-2 text-sm ${
                semanticAvailable ? "text-gray-600" : "text-gray-400"
              }`}
            >
              <input
                type="radio"
                name="mode"
                value="semantic"
                defaultChecked={mode === "semantic"}
                disabled={!semanticAvailable}
                className="text-brand-600 focus:ring-brand-500"
              />
              AI セマンティック検索
              {!semanticAvailable && (
                <span className="text-xs text-gray-400">(準備中)</span>
              )}
            </label>
          </div>
        </Form>

        {/* Results */}
        {query && (
          <div>
            <p className="mb-4 text-sm text-gray-500">
              「{query}」の検索結果: {posts.length} 件
              {mode === "semantic" && (
                <span className="ml-2 rounded-full bg-brand-100 px-2 py-0.5 text-xs font-medium text-brand-700">
                  AI セマンティック
                </span>
              )}
            </p>

            {posts.length > 0 ? (
              <div className="space-y-4">
                {posts.map((post) => (
                  <Link
                    key={post.id}
                    to={`/posts/${post.slug}`}
                    className="block rounded-xl border border-gray-200 bg-white p-5 transition-all hover:border-gray-400 hover:shadow-sm"
                  >
                    <div className="mb-1 flex items-center gap-2">
                      {post.categoryName && (
                        <span className="text-xs font-medium text-brand-600">
                          {post.categoryName}
                        </span>
                      )}
                      {post.publishedAt && (
                        <span className="text-xs text-gray-400">
                          {new Date(post.publishedAt).toLocaleDateString("ja-JP")}
                        </span>
                      )}
                      {post.score !== undefined && (
                        <span className="text-xs text-gray-400">
                          関連度: {Math.round(post.score * 100)}%
                        </span>
                      )}
                    </div>
                    <h3 className="text-base font-semibold text-gray-900">
                      {post.title}
                    </h3>
                    {post.excerpt && (
                      <p className="mt-1 text-sm text-gray-500 line-clamp-2">
                        {post.excerpt}
                      </p>
                    )}
                    <p className="mt-2 text-xs text-gray-400">
                      by {post.authorName}
                    </p>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50/50 p-12 text-center">
                <p className="text-sm text-gray-400">
                  該当する記事が見つかりませんでした
                </p>
              </div>
            )}
          </div>
        )}

        {!query && (
          <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50/50 p-12 text-center">
            <p className="text-base text-gray-400">
              キーワードや質問を入力して検索してください
            </p>
            <p className="mt-2 text-sm text-gray-400">
              AI セマンティック検索では、自然言語で質問するように検索できます
            </p>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="mt-auto border-t bg-gray-900 py-10 text-gray-500">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
            <Link
              to="/"
              className="text-sm font-medium text-gray-400 hover:text-gray-300 transition-colors"
            >
              {siteName}
            </Link>
            <p className="text-xs text-gray-600">
              Built on Cloudflare — Workers, Pages, D1, R2, AI
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
