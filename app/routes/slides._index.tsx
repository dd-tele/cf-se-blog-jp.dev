import type { LoaderFunctionArgs, MetaFunction } from "@remix-run/cloudflare";
import { useLoaderData, Link } from "@remix-run/react";
import { getPublishedSlides } from "~/lib/slides.server";
import { getSessionUser } from "~/lib/auth.server";

export const meta: MetaFunction = () => [
  { title: "スライド一覧 — Cloudflare フィールドノート" },
  {
    name: "description",
    content:
      "イベント登壇資料やアーキテクチャ解説など、公開可能な HTML スライドのアーカイブ。",
  },
];

export async function loader({ context, request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const search = url.searchParams.get("q") ?? undefined;
  const db = context.cloudflare.env.DB;

  const [slidesList, user] = await Promise.all([
    getPublishedSlides(db, { search, limit: 48 }),
    getSessionUser(request),
  ]);

  const visible = user
    ? slidesList
    : slidesList.filter((s) => (s.visibility ?? "public") === "public");

  return {
    slides: visible,
    search: search ?? null,
    user,
    siteName: context.cloudflare.env.SITE_NAME ?? "Cloudflare Field Notes",
  };
}

export default function SlidesIndex() {
  const { slides, search, user, siteName } = useLoaderData<typeof loader>();

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-50 border-b bg-white/80 backdrop-blur-sm">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link to="/" className="text-lg font-bold text-gray-900 hover:text-brand-600 transition-colors">
            {siteName}
          </Link>
          <nav className="flex items-center gap-4">
            <Link to="/posts" className="text-sm text-gray-600 hover:text-gray-900">
              事例
            </Link>
            <Link to="/slides" className="text-sm font-medium text-brand-600">
              スライド
            </Link>
            <Link to="/about" className="text-sm text-gray-600 hover:text-gray-900">
              このブログについて
            </Link>
            {user ? (
              <Link to="/portal" className="text-sm font-medium text-gray-600 hover:text-gray-900">
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
        <div className="mb-8">
          <h1 className="mb-1 text-3xl font-bold text-gray-900">スライド</h1>
          <p className="mb-4 text-sm text-gray-500">
            イベント登壇資料やアーキテクチャ解説など、公開可能な HTML スライドのアーカイブ
          </p>
          <form method="get" className="flex gap-2">
            <input
              type="text"
              name="q"
              defaultValue={search ?? ""}
              placeholder="スライドを検索..."
              className="flex-1 rounded-lg border border-gray-300 px-4 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
            <button
              type="submit"
              className="rounded-lg bg-brand-500 px-6 py-2 text-sm font-medium text-white hover:bg-brand-600 transition-colors"
            >
              検索
            </button>
          </form>
        </div>

        {slides.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-16 text-center">
            <p className="text-lg text-gray-500">
              {search
                ? `「${search}」に一致するスライドが見つかりませんでした`
                : "まだスライドが公開されていません"}
            </p>
            {user && (
              <Link
                to="/portal/slides/new"
                className="mt-4 inline-block rounded-lg bg-brand-500 px-6 py-2 text-sm font-medium text-white hover:bg-brand-600 transition-colors"
              >
                スライドをアップロードする
              </Link>
            )}
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {slides.map((s) => (
              <Link
                key={s.id}
                to={`/slides/${s.slug}`}
                className="group flex flex-col overflow-hidden rounded-xl border border-gray-200 bg-white transition-all hover:border-gray-400 hover:shadow-md"
              >
                <div className="relative aspect-[16/9] overflow-hidden bg-gradient-to-br from-gray-900 to-gray-700">
                  {s.coverImageUrl ? (
                    <img
                      src={s.coverImageUrl}
                      alt={s.title}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full flex-col items-center justify-center p-4 text-center">
                      <span className="text-xs font-semibold uppercase tracking-widest text-brand-400">
                        Slides
                      </span>
                      <span className="mt-1 line-clamp-2 text-sm font-medium text-white/90">
                        {s.title}
                      </span>
                    </div>
                  )}
                  <span className="absolute bottom-2 right-2 rounded-full bg-black/60 px-2 py-0.5 text-[11px] font-medium text-white">
                    {s.slideCount} スライド
                  </span>
                </div>
                <div className="flex flex-1 flex-col p-5">
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    {s.visibility === "limited" && (
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700">
                        限定
                      </span>
                    )}
                    {s.eventName && (
                      <span className="rounded-full bg-brand-50 px-2.5 py-0.5 text-xs font-medium text-brand-700">
                        {s.eventName}
                      </span>
                    )}
                  </div>
                  <h2 className="mb-2 line-clamp-2 text-lg font-semibold text-gray-900 group-hover:text-brand-600">
                    {s.title}
                  </h2>
                  {s.description && (
                    <p className="mb-4 line-clamp-2 flex-1 text-sm leading-relaxed text-gray-500">
                      {s.description}
                    </p>
                  )}
                  <div className="mt-auto flex items-center justify-between border-t border-gray-100 pt-3 text-xs text-gray-400">
                    <span>{s.authorName}</span>
                    <span>
                      {s.presentedAt
                        ? new Date(s.presentedAt).toLocaleDateString("ja-JP")
                        : new Date(s.createdAt).toLocaleDateString("ja-JP")}
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
