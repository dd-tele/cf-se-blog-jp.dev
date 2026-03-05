import type { LoaderFunctionArgs, MetaFunction } from "@remix-run/cloudflare";
import { useLoaderData, Link, useSearchParams } from "@remix-run/react";
import { getPublishedPosts, getAllCategories } from "~/lib/posts.server";
import { getSessionUser } from "~/lib/auth.server";
import { getCached, CacheKeys } from "~/lib/cache.server";
import { stripMarkdown } from "~/lib/utils";

export const meta: MetaFunction = () => [
  { title: "事例一覧 — Cloudflare Solution Blog" },
];

export async function loader({ context, request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const categorySlug = url.searchParams.get("category") ?? undefined;
  const search = url.searchParams.get("q") ?? undefined;
  const page = parseInt(url.searchParams.get("page") ?? "1", 10);
  const limit = 12;
  const offset = (page - 1) * limit;

  const db = context.cloudflare.env.DB;
  const kv = context.cloudflare.env.PAGE_CACHE;

  // Cache posts list and categories (skip cache if search query)
  const [postsList, categoriesList, user] = await Promise.all([
    search
      ? getPublishedPosts(db, { limit, offset, categorySlug, search })
      : getCached(kv, CacheKeys.publishedPosts(page, categorySlug ?? ""), () =>
          getPublishedPosts(db, { limit, offset, categorySlug, search })
        ),
    getCached(kv, CacheKeys.categories(), () => getAllCategories(db), 600),
    getSessionUser(request),
  ]);

  return {
    posts: postsList,
    categories: categoriesList,
    currentCategory: categorySlug ?? null,
    search: search ?? null,
    page,
    user,
    siteName: context.cloudflare.env.SITE_NAME ?? "Cloudflare Solution Blog",
  };
}

export default function PostsIndex() {
  const { posts, categories, currentCategory, search, page, user, siteName } =
    useLoaderData<typeof loader>();
  const [searchParams] = useSearchParams();

  return (
    <div className="flex min-h-screen flex-col">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b bg-white/80 backdrop-blur-sm">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link to="/" className="text-lg font-bold text-gray-900 hover:text-brand-600 transition-colors">
            {siteName}
          </Link>
          <nav className="flex items-center gap-4">
            <Link to="/about" className="text-sm text-gray-600 hover:text-gray-900">
              このブログについて
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

      <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Search + Filter */}
        <div className="mb-8">
          <h1 className="mb-1 text-3xl font-bold text-gray-900">事例一覧</h1>
          <p className="mb-4 text-sm text-gray-500">Cloudflare SE とユーザーのエンジニアリング事例</p>
          <form method="get" className="flex gap-2">
            <input
              type="text"
              name="q"
              defaultValue={search ?? ""}
              placeholder="事例を検索..."
              className="flex-1 rounded-lg border border-gray-300 px-4 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
            {currentCategory && (
              <input type="hidden" name="category" value={currentCategory} />
            )}
            <button
              type="submit"
              className="rounded-lg bg-brand-500 px-6 py-2 text-sm font-medium text-white hover:bg-brand-600 transition-colors"
            >
              検索
            </button>
          </form>
        </div>

        {/* Categories */}
        <div className="mb-8 flex flex-wrap gap-2">
          <Link
            to="/posts"
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
              !currentCategory
                ? "bg-brand-500 text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            すべて
          </Link>
          {categories.map((cat) => (
            <Link
              key={cat.id}
              to={`/posts?category=${cat.slug}`}
              className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                currentCategory === cat.slug
                  ? "bg-brand-500 text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {cat.name}
            </Link>
          ))}
        </div>

        {/* Posts Grid */}
        {posts.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-16 text-center">
            <p className="text-lg text-gray-500">
              {search
                ? `「${search}」に一致する事例が見つかりませんでした`
                : "まだ事例が投稿されていません"}
            </p>
            <Link
              to="/portal/new"
              className="mt-4 inline-block rounded-lg bg-brand-500 px-6 py-2 text-sm font-medium text-white hover:bg-brand-600 transition-colors"
            >
              最初の事例を投稿する
            </Link>
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {posts.map((post) => (
              <Link
                key={post.id}
                to={`/posts/${post.slug}`}
                className="group flex flex-col rounded-xl border border-gray-200 bg-white p-5 transition-all hover:border-gray-400 hover:shadow-md"
              >
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  {post.categoryName && (
                    <span className="rounded-full bg-brand-50 px-2.5 py-0.5 text-xs font-medium text-brand-700">
                      {post.categoryName}
                    </span>
                  )}
                  {post.tagsJson && (() => {
                    try {
                      const tags: string[] = JSON.parse(post.tagsJson);
                      return tags.slice(0, 3).map((tag) => (
                        <span key={tag} className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">
                          {tag}
                        </span>
                      ));
                    } catch { return null; }
                  })()}
                </div>
                <h2 className="mb-2 text-lg font-semibold text-gray-900 line-clamp-2 group-hover:text-brand-600">
                  {post.title}
                </h2>
                {post.excerpt && (
                  <p className="mb-4 flex-1 text-sm leading-relaxed text-gray-500 line-clamp-2">
                    {stripMarkdown(post.excerpt)}
                  </p>
                )}
                <div className="flex items-center justify-between border-t border-gray-100 pt-3 text-xs text-gray-400">
                  <span>{post.authorName}</span>
                  <div className="flex items-center gap-2">
                    {post.readingTimeMinutes && (
                      <span>{post.readingTimeMinutes}分</span>
                    )}
                    {post.publishedAt && (
                      <span>
                        {new Date(post.publishedAt).toLocaleDateString("ja-JP")}
                      </span>
                    )}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}

        {/* Pagination */}
        {posts.length > 0 && (
          <div className="mt-8 flex justify-center gap-2">
            {page > 1 && (
              <Link
                to={`/posts?page=${page - 1}${currentCategory ? `&category=${currentCategory}` : ""}${search ? `&q=${search}` : ""}`}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm hover:bg-gray-50"
              >
                前へ
              </Link>
            )}
            <span className="flex items-center px-4 text-sm text-gray-500">
              ページ {page}
            </span>
            {posts.length === 12 && (
              <Link
                to={`/posts?page=${page + 1}${currentCategory ? `&category=${currentCategory}` : ""}${search ? `&q=${search}` : ""}`}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm hover:bg-gray-50"
              >
                次へ
              </Link>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
