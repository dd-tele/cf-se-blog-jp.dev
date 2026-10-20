import type { LoaderFunctionArgs, MetaFunction } from "@remix-run/cloudflare";
import { Link, useLoaderData } from "@remix-run/react";
import { getSessionUser } from "~/lib/auth.server";
import { getAllCategories, getPublishedPosts } from "~/lib/posts.server";
import { userCanUploadGuides } from "~/lib/case-guides.server";
import { SiteNav } from "~/components/SiteNav";

export const meta: MetaFunction = () => [
  { title: "事例 - 設計ガイド — Cloudflare フィールドノート" },
  {
    name: "description",
    content:
      "導入事例をもとに、アーキテクチャの設計判断とダッシュボードの各画面・設定項目を詳しく解説する設計ガイドです。",
  },
];

const PAGE_SIZE = 24;

export async function loader({ request, context }: LoaderFunctionArgs) {
  const env = context.cloudflare.env;
  const url = new URL(request.url);
  const search = url.searchParams.get("q")?.trim() || undefined;
  const categorySlug = url.searchParams.get("category") || undefined;
  const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1", 10) || 1);

  const user = await getSessionUser(request);
  const [list, categories] = await Promise.all([
    // Anonymous visitors only see public guides; filter in SQL so paging stays correct.
    getPublishedPosts(env.DB, {
      contentType: "case_guide",
      search,
      categorySlug,
      visibility: user ? "all" : "public",
      limit: PAGE_SIZE,
      offset: (page - 1) * PAGE_SIZE,
    }),
    getAllCategories(env.DB),
  ]);

  const guides = list;
  const canUpload = user ? await userCanUploadGuides(env.DB, user) : false;

  return {
    user,
    guides,
    categories,
    search: search ?? "",
    currentCategory: categorySlug ?? null,
    page,
    hasNext: list.length === PAGE_SIZE,
    canUpload,
    siteName: env.SITE_NAME ?? "Cloudflare Field Notes",
  };
}

function parseTags(json: string | null): string[] {
  try {
    return json ? (JSON.parse(json) as string[]) : [];
  } catch {
    return [];
  }
}

export default function CaseGuideIndex() {
  const { user, guides, categories, search, currentCategory, page, hasNext, canUpload, siteName } =
    useLoaderData<typeof loader>();
  const query = (p: number) =>
    `/cases?page=${p}${currentCategory ? `&category=${currentCategory}` : ""}${search ? `&q=${encodeURIComponent(search)}` : ""}`;

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <header className="sticky top-0 z-50 border-b bg-white/80 backdrop-blur-sm">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link to="/" className="text-lg font-bold text-gray-900 transition-colors hover:text-brand-600">
            {siteName}
          </Link>
          <nav className="flex items-center gap-4">
            <SiteNav active="cases" />
            {user ? (
              <Link to="/portal" className="text-sm font-medium text-gray-600 hover:text-gray-900">
                ダッシュボード
              </Link>
            ) : (
              <a href="/portal" className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600">
                ログイン
              </a>
            )}
          </nav>
        </div>
      </header>

      <section className="border-b bg-gray-50">
        <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
          <p className="text-xs font-extrabold tracking-[0.14em] text-brand-500">CASE STUDY · DESIGN GUIDE</p>
          <h1 className="mt-1 text-3xl font-bold text-gray-900">事例 - 設計ガイド</h1>
          <p className="mt-3 max-w-3xl text-sm leading-relaxed text-gray-600">
            導入事例の構成をもとに、アーキテクチャの設計判断と、ダッシュボードの各画面・設定項目の意味、仕組み、
            確認すべき点を章立てで解説します。左の目次から必要な画面だけを参照できる、リファレンスを兼ねたガイドです。
          </p>
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <form method="get" className="flex min-w-[18rem] flex-1 gap-2">
              <input
                type="text"
                name="q"
                defaultValue={search}
                placeholder="設計ガイドを検索..."
                className="flex-1 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              />
              {currentCategory && <input type="hidden" name="category" value={currentCategory} />}
              <button type="submit" className="rounded-lg bg-gray-900 px-5 py-2 text-sm font-medium text-white hover:bg-gray-800">
                検索
              </button>
            </form>
            {canUpload && (
              <Link
                to="/portal/cases/new"
                className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                ZIP をアップロード
              </Link>
            )}
          </div>
          <div className="mt-5 flex flex-wrap gap-2">
            <Link
              to="/cases"
              className={`rounded-full px-4 py-1.5 text-sm font-medium ${!currentCategory ? "bg-brand-500 text-white" : "bg-white text-gray-600 ring-1 ring-gray-200 hover:bg-gray-100"}`}
            >
              すべて
            </Link>
            {categories.map((cat) => (
              <Link
                key={cat.id}
                to={`/cases?category=${cat.slug}`}
                className={`rounded-full px-4 py-1.5 text-sm font-medium ${currentCategory === cat.slug ? "bg-brand-500 text-white" : "bg-white text-gray-600 ring-1 ring-gray-200 hover:bg-gray-100"}`}
              >
                {cat.name}
              </Link>
            ))}
          </div>
        </div>
      </section>

      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-10 sm:px-6 lg:px-8">
        {guides.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-300 p-16 text-center text-sm text-gray-500">
            {search ? `「${search}」に一致する設計ガイドは見つかりませんでした。` : "公開中の設計ガイドはまだありません。"}
          </div>
        ) : (
          <div className="grid gap-x-8 gap-y-2 lg:grid-cols-2">
            {guides.map((g) => (
              <article key={g.id} className="group relative border-t-2 border-gray-900 py-5">
                <div className="mb-2 flex flex-wrap items-center gap-2 text-xs">
                  <span className="font-extrabold tracking-[0.12em] text-brand-500">DESIGN GUIDE</span>
                  {g.categoryName && <span className="text-gray-500">{g.categoryName}</span>}
                  {g.visibility === "limited" && (
                    <span className="rounded-full bg-amber-100 px-2 py-0.5 font-semibold text-amber-700">限定</span>
                  )}
                </div>
                <h2 className="text-lg font-bold leading-snug text-gray-900 group-hover:text-brand-600">
                  <Link to={`/cases/${g.slug}`} className="after:absolute after:inset-0">
                    {g.title}
                  </Link>
                </h2>
                {g.excerpt && <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-gray-600">{g.excerpt}</p>}
                <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-400">
                  <Link to={`/authors/${g.authorId}`} className="relative z-10 hover:text-brand-600">
                    {g.authorName}
                  </Link>
                  {g.publishedAt && <span>{new Date(g.publishedAt).toLocaleDateString("ja-JP")}</span>}
                  {g.readingTimeMinutes && <span>約 {g.readingTimeMinutes} 分</span>}
                  {parseTags(g.tagsJson).slice(0, 4).map((t) => (
                    <span key={t} className="text-gray-500">#{t}</span>
                  ))}
                </div>
              </article>
            ))}
          </div>
        )}

        {(page > 1 || hasNext) && (
          <div className="mt-10 flex justify-center gap-2 text-sm">
            {page > 1 && (
              <Link to={query(page - 1)} className="rounded-lg border border-gray-300 px-4 py-2 hover:bg-gray-50">
                前へ
              </Link>
            )}
            <span className="flex items-center px-4 text-gray-500">ページ {page}</span>
            {hasNext && (
              <Link to={query(page + 1)} className="rounded-lg border border-gray-300 px-4 py-2 hover:bg-gray-50">
                次へ
              </Link>
            )}
          </div>
        )}
      </main>

      <footer className="border-t bg-gray-900 py-8 text-center text-xs text-gray-500">
        Cloudflare Field Notes — 事例 - 設計ガイド
      </footer>
    </div>
  );
}
