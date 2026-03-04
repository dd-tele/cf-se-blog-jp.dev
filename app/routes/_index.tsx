import type { MetaFunction, LoaderFunctionArgs } from "@remix-run/cloudflare";
import { useLoaderData, Link } from "@remix-run/react";
import { getSessionUser } from "~/lib/auth.server";
import { getPublishedPosts } from "~/lib/posts.server";

export const meta: MetaFunction = () => {
  return [
    { title: "Cloudflare Solution Blog — Engineering Case Studies" },
    {
      name: "description",
      content:
        "Cloudflare SE とユーザーが実践したエンジニアリング事例を共有するテクニカルブログ。設計判断、実装パターン、運用知見をリアルな現場目線で発信します。",
    },
  ];
};

export async function loader({ context, request }: LoaderFunctionArgs) {
  const user = await getSessionUser(request);
  const db = context.cloudflare.env.DB;
  const latestPosts = await getPublishedPosts(db, { limit: 6 });
  return {
    siteName: context.cloudflare.env.SITE_NAME ?? "Cloudflare Solution Blog",
    user,
    latestPosts,
  };
}

export default function Index() {
  const { siteName, user, latestPosts } = useLoaderData<typeof loader>();

  return (
    <div className="flex min-h-screen flex-col">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b bg-white/80 backdrop-blur-sm">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link to="/" className="text-lg font-bold text-gray-900 hover:text-brand-600 transition-colors">
            {siteName}
          </Link>
          <nav className="hidden items-center gap-6 md:flex">
            <Link
              to="/search"
              className="text-sm text-gray-600 hover:text-gray-900"
            >
              検索
            </Link>
            {user ? (
              <div className="flex items-center gap-3">
                <Link
                  to="/portal"
                  className="text-sm font-medium text-gray-700 hover:text-gray-900"
                >
                  {user.displayName}
                </Link>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                    user.role === "admin"
                      ? "bg-red-100 text-red-700"
                      : user.role === "se"
                        ? "bg-blue-100 text-blue-700"
                        : "bg-green-100 text-green-700"
                  }`}
                >
                  {user.role}
                </span>
                <Link
                  to="/auth/logout"
                  className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs text-gray-500 hover:bg-gray-50"
                >
                  ログアウト
                </Link>
              </div>
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

      {/* Hero Section */}
      <section className="relative overflow-hidden border-b bg-white py-20 sm:py-28">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#f8fafc_1px,transparent_1px),linear-gradient(to_bottom,#f8fafc_1px,transparent_1px)] bg-[size:4rem_4rem]" />
        <div className="relative mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          <p className="mb-4 text-sm font-semibold uppercase tracking-widest text-brand-600">
            Engineering Case Studies
          </p>
          <h1 className="text-4xl font-bold leading-[1.15] tracking-tight text-gray-900 sm:text-5xl lg:text-6xl">
            現場のエンジニアリングを、
            <br />
            <span className="text-brand-600">事例で伝える。</span>
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-relaxed text-gray-500">
            Cloudflare SE とユーザーが取り組んだ設計判断、実装パターン、運用の工夫をリアルな視点で共有するテクニカルブログです。
          </p>
          <div className="mt-10 flex items-center gap-4">
            <Link
              to="/posts"
              className="rounded-lg bg-gray-900 px-7 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-gray-800"
            >
              事例を読む
            </Link>
            <Link
              to="/portal/templates"
              className="rounded-lg border border-gray-300 bg-white px-7 py-3 text-sm font-semibold text-gray-700 shadow-sm transition-colors hover:bg-gray-50"
            >
              事例を投稿する
            </Link>
            <Link
              to="/about"
              className="rounded-lg border border-gray-300 bg-white px-7 py-3 text-sm font-semibold text-gray-700 shadow-sm transition-colors hover:bg-gray-50"
            >
              このブログについて
            </Link>
          </div>
        </div>
      </section>

      {/* Categories */}
      <section className="border-b py-12">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <h2 className="mb-6 text-xs font-semibold uppercase tracking-widest text-gray-400">
            Topics
          </h2>
          <div className="flex flex-wrap gap-3">
            {[
              { name: "Application Services", slug: "application", desc: "WAF / CDN / Bot Management / Load Balancing" },
              { name: "Zero Trust", slug: "zero-trust", desc: "Access / Gateway / CASB / Browser Isolation" },
              { name: "Developer Platform", slug: "dev-platform", desc: "Workers / Pages / D1 / R2 / AI" },
              { name: "Email Security", slug: "email-security", desc: "Email Routing / Area 1 / DMARC" },
              { name: "Network Services", slug: "network", desc: "Magic Transit / Magic WAN / Spectrum" },
              { name: "General", slug: "other", desc: "業界動向 / イベント / その他" },
            ].map((cat) => (
              <Link
                key={cat.slug}
                to={`/posts?category=${cat.slug}`}
                className="group rounded-lg border border-gray-200 bg-white px-5 py-3 transition-all hover:border-gray-400 hover:shadow-sm"
              >
                <span className="block text-sm font-semibold text-gray-900 group-hover:text-brand-600">
                  {cat.name}
                </span>
                <span className="mt-0.5 block text-xs text-gray-400">
                  {cat.desc}
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Latest Posts */}
      <section className="py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mb-8 flex items-end justify-between">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">最新の事例</h2>
              <p className="mt-1 text-sm text-gray-500">
                SE とユーザーの最新エンジニアリング事例
              </p>
            </div>
            <Link
              to="/posts"
              className="text-sm font-medium text-gray-500 hover:text-gray-900"
            >
              すべて見る →
            </Link>
          </div>

          {latestPosts.length === 0 ? (
            <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50/50 p-16 text-center">
              <p className="text-base text-gray-400">
                まだ事例が投稿されていません
              </p>
              <p className="mt-2 text-sm text-gray-400">
                最初のエンジニアリング事例を投稿して、知見を共有しましょう。
              </p>
              <Link
                to="/portal/templates"
                className="mt-6 inline-block rounded-lg bg-gray-900 px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-gray-800"
              >
                事例を投稿する
              </Link>
            </div>
          ) : (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {latestPosts.map((post) => (
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
                  <h3 className="text-lg font-semibold text-gray-900 group-hover:text-brand-600 line-clamp-2">
                    {post.title}
                  </h3>
                  {post.excerpt && (
                    <p className="mt-2 flex-1 text-sm leading-relaxed text-gray-500 line-clamp-2">
                      {post.excerpt}
                    </p>
                  )}
                  <div className="mt-4 flex items-center justify-between border-t border-gray-100 pt-3 text-xs text-gray-400">
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
        </div>
      </section>

      {/* Value Props */}
      <section className="border-t bg-gray-50 py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid gap-8 sm:grid-cols-3">
            <div>
              <h3 className="text-sm font-bold uppercase tracking-wide text-gray-900">
                Real-World Cases
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-gray-500">
                机上の理論ではなく、実際のプロジェクトで直面した課題と解決策をエンジニアリング視点で記録します。
              </p>
            </div>
            <div>
              <h3 className="text-sm font-bold uppercase tracking-wide text-gray-900">
                SE × Customer
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-gray-500">
                Cloudflare SE とユーザーが協働した技術検証、設計レビュー、移行事例などを幅広くカバーします。
              </p>
            </div>
            <div>
              <h3 className="text-sm font-bold uppercase tracking-wide text-gray-900">
                Open Knowledge
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-gray-500">
                設計の背景、トレードオフの判断、ハマりどころまで。次のエンジニアが再現できるレベルの知見を残します。
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="mt-auto border-t bg-gray-900 py-10 text-gray-500">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
            <Link to="/" className="text-sm font-medium text-gray-400 hover:text-gray-300 transition-colors">
              {siteName}
            </Link>
            <div className="flex items-center gap-4">
              <a href="/feed.xml" className="text-xs text-gray-500 hover:text-gray-400 transition-colors">RSS</a>
              <a href="/sitemap.xml" className="text-xs text-gray-500 hover:text-gray-400 transition-colors">Sitemap</a>
              <span className="text-xs text-gray-600">
                Built on Cloudflare — Workers, Pages, D1, R2, AI
              </span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
