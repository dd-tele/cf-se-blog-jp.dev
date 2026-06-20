import type { LoaderFunctionArgs, MetaFunction } from "@remix-run/cloudflare";
import { json } from "@remix-run/cloudflare";
import { useLoaderData, Link } from "@remix-run/react";
import { getSlideBySlug } from "~/lib/slides.server";
import { getSessionUser } from "~/lib/auth.server";

export const meta: MetaFunction<typeof loader> = ({ data }) => {
  if (!data?.slide) return [{ title: "スライドが見つかりません — Cloudflare フィールドノート" }];
  return [
    { title: `${data.slide.title} — Cloudflare フィールドノート` },
    { name: "description", content: data.slide.description ?? "" },
  ];
};

export async function loader({ params, context, request }: LoaderFunctionArgs) {
  const slug = params.slug!;
  const db = context.cloudflare.env.DB;

  const slide = await getSlideBySlug(db, slug);
  if (!slide) {
    throw new Response("Not Found", { status: 404 });
  }

  const user = await getSessionUser(request);
  const restricted = slide.status !== "published" || slide.visibility === "limited";
  if (restricted && !user) {
    return json({ slide, locked: true as const, user: null });
  }

  return json({ slide, locked: false as const, user });
}

export default function SlideDetail() {
  const { slide, locked, user } = useLoaderData<typeof loader>();
  const tags: string[] = (() => {
    try {
      return slide.tagsJson ? JSON.parse(slide.tagsJson) : [];
    } catch {
      return [];
    }
  })();

  return (
    <div className="flex min-h-screen flex-col bg-gray-50">
      <header className="sticky top-0 z-50 border-b bg-white/80 backdrop-blur-sm">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link to="/" className="text-lg font-bold text-gray-900 hover:text-brand-600 transition-colors">
            Cloudflare Field Notes
          </Link>
          <nav className="flex items-center gap-4">
            <Link to="/slides" className="text-sm text-gray-600 hover:text-gray-900">
              ← スライド一覧
            </Link>
            {user && (
              <Link to="/portal/slides" className="text-sm text-gray-600 hover:text-gray-900">
                管理
              </Link>
            )}
          </nav>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-4 flex flex-wrap items-center gap-2">
          {slide.visibility === "limited" && (
            <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-700">
              限定公開
            </span>
          )}
          {slide.status !== "published" && (
            <span className="rounded-full bg-gray-200 px-2.5 py-0.5 text-xs font-semibold text-gray-600">
              下書き
            </span>
          )}
          {slide.eventName && (
            <span className="rounded-full bg-brand-50 px-2.5 py-0.5 text-xs font-medium text-brand-700">
              {slide.eventName}
            </span>
          )}
        </div>

        <h1 className="text-3xl font-bold leading-tight text-gray-900">{slide.title}</h1>
        {slide.description && (
          <p className="mt-3 text-base leading-relaxed text-gray-600">{slide.description}</p>
        )}

        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-500">
          <Link to={`/authors/${slide.authorId}`} className="hover:text-brand-600">
            {slide.authorName}
          </Link>
          <span>{slide.slideCount} スライド</span>
          {slide.presentedAt && (
            <span>{new Date(slide.presentedAt).toLocaleDateString("ja-JP")}</span>
          )}
          <span>{slide.viewCount} 回表示</span>
        </div>

        {tags.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {tags.map((t) => (
              <span key={t} className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">
                #{t}
              </span>
            ))}
          </div>
        )}

        {locked ? (
          <div className="mt-8 rounded-xl border border-dashed border-amber-300 bg-amber-50 p-10 text-center">
            <p className="text-base font-medium text-amber-800">
              このスライドは限定公開です。表示するにはログインしてください。
            </p>
            <a
              href="/portal"
              className="mt-4 inline-block rounded-lg bg-brand-500 px-6 py-2 text-sm font-medium text-white hover:bg-brand-600"
            >
              ログイン
            </a>
          </div>
        ) : (
          <>
            <div className="mt-8 overflow-hidden rounded-xl border border-gray-200 bg-black shadow-sm">
              <iframe
                src={`/slides/${slide.slug}/a/`}
                title={slide.title}
                className="aspect-[16/9] w-full"
                allowFullScreen
              />
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <a
                href={`/slides/${slide.slug}/a/`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-lg bg-gray-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-gray-800"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                </svg>
                全画面で開く
              </a>
              <p className="text-xs text-gray-400">
                矢印キーまたは画面下のコントロールでスライドを操作できます。
              </p>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
