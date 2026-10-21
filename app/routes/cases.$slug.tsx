import type { LoaderFunctionArgs, MetaFunction } from "@remix-run/cloudflare";
import { redirect } from "@remix-run/cloudflare";
import { Link, useLoaderData } from "@remix-run/react";
import { getSessionUser } from "~/lib/auth.server";
import { getPostBySlug } from "~/lib/posts.server";
import { SiteNav } from "~/components/SiteNav";
import { issueGuideToken } from "~/lib/guide-token.server";
import { CASE_KINDS, caseDisplayTitle, caseKind, caseKindBadgeClass } from "~/lib/case-kind";

export const meta: MetaFunction<typeof loader> = ({ data }) => {
  if (!data) return [{ title: "事例が見つかりません" }];
  const title = `${data.guide.title} — 事例 | Cloudflare フィールドノート`;
  if (data.locked) return [{ title }];
  const description = data.guide.metaDescription || data.guide.excerpt || "";
  return [
    { title },
    { name: "description", content: description },
    { property: "og:type", content: "article" },
    { property: "og:title", content: title },
    { property: "og:description", content: description },
    { property: "og:url", content: `${data.siteUrl}/cases/${data.guide.slug}` },
    { property: "og:site_name", content: "Cloudflare フィールドノート" },
  ];
};

export async function loader({ params, request, context }: LoaderFunctionArgs) {
  const env = context.cloudflare.env;
  const post = await getPostBySlug(env.DB, params.slug!);
  if (!post) throw new Response("Not Found", { status: 404 });
  if (post.contentType !== "case_guide") throw redirect(`/posts/${post.slug}`);

  const user = await getSessionUser(request);
  const published = post.status === "published";
  const canManage = !!user && (user.id === post.authorId || user.role === "admin");
  if (!published && !canManage) throw new Response("Not Found", { status: 404 });

  const locked = post.visibility === "limited" && !user;
  const siteUrl = env.SITE_URL ?? "https://cf-se-blog-jp.dev";

  // Anonymous viewers of a limited guide get only what the lock screen shows.
  if (locked) {
    return {
      guide: {
        id: post.id,
        slug: post.slug,
        title: post.title,
        status: post.status,
        visibility: post.visibility,
        authorName: post.authorName,
        publishedAt: post.publishedAt,
        updatedAt: post.updatedAt,
        metaDescription: null as string | null,
        excerpt: null as string | null,
      },
      src: null as string | null,
      user,
      locked,
      canManage,
      siteUrl,
    };
  }

  const restricted = !published || post.visibility === "limited";
  const base = `/cases/${post.slug}/a/`;
  const src = restricted ? `${base}${await issueGuideToken(post.id, post.assetPrefix)}/` : base;
  return {
    guide: {
      id: post.id,
      slug: post.slug,
      title: post.title,
      status: post.status,
      visibility: post.visibility,
      authorName: post.authorName,
      publishedAt: post.publishedAt,
      updatedAt: post.updatedAt,
      metaDescription: post.metaDescription,
      excerpt: post.excerpt,
    },
    src: src as string | null,
    user,
    locked,
    canManage,
    siteUrl,
  };
}

export const headers = () => ({ "Cache-Control": "private, no-store" });

export default function CaseGuideDetail() {
  const { guide, src, user, locked, canManage } = useLoaderData<typeof loader>();
  const date = guide.publishedAt ?? guide.updatedAt;
  const kind = caseKind(guide.title);

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-white">
      <header className="z-40 flex h-14 shrink-0 items-center gap-4 border-b bg-white px-4 sm:px-6">
        <Link to="/" className="hidden text-sm font-bold text-gray-900 hover:text-brand-600 lg:block">
          Cloudflare Field Notes
        </Link>
        <nav className="hidden items-center gap-4 border-l pl-4 md:flex">
          <SiteNav active="cases" />
        </nav>
        <div className="flex min-w-0 flex-1 items-center gap-2 border-l pl-4">
          {guide.status !== "published" && (
            <span className="shrink-0 rounded-full bg-gray-200 px-2 py-0.5 text-xs font-semibold text-gray-700">下書き</span>
          )}
          <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-bold ${caseKindBadgeClass(kind)}`}>
            {CASE_KINDS[kind].label}
          </span>
          {guide.visibility === "limited" && (
            <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700">限定</span>
          )}
          <h1 className="truncate text-sm font-semibold text-gray-900" title={guide.title}>
            {caseDisplayTitle(guide.title)}
          </h1>
          <span className="hidden shrink-0 text-xs text-gray-400 xl:inline">
            {guide.authorName}
            {date ? ` · ${new Date(date).toLocaleDateString("ja-JP")}` : ""}
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {src && (
            <a
              href={src}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50"
            >
              全画面で開く
            </a>
          )}
          {canManage && (
            <Link
              to={`/portal/edit/${guide.id}`}
              className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50"
            >
              編集
            </Link>
          )}
          {!user && (
            <a href="/portal" className="rounded-lg bg-brand-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-600">
              ログイン
            </a>
          )}
        </div>
      </header>

      {locked || !src ? (
        <main className="flex flex-1 items-center justify-center px-4">
          <div className="max-w-lg text-center">
            <p className="text-xs font-extrabold tracking-[0.14em] text-brand-500">{CASE_KINDS[kind].en}</p>
            <h2 className="mt-2 text-2xl font-bold text-gray-900">限定公開の{CASE_KINDS[kind].label}です</h2>
            <p className="mt-2 font-medium text-gray-700">{guide.title}</p>
            <p className="mt-4 text-sm leading-relaxed text-gray-500">
              この{CASE_KINDS[kind].label}はログインユーザー限定で公開されています。ログインしてご覧ください。
            </p>
            <a
              href="/portal"
              className="mt-8 inline-block rounded-lg bg-gray-900 px-8 py-3 text-sm font-semibold text-white hover:bg-gray-800"
            >
              ログインして閲覧する
            </a>
            <div className="mt-4">
              <Link to="/cases" className="text-sm text-gray-500 hover:text-gray-700">
                ← 事例一覧に戻る
              </Link>
            </div>
          </div>
        </main>
      ) : (
        <iframe
          src={src}
          title={guide.title}
          sandbox="allow-scripts allow-popups allow-popups-to-escape-sandbox"
          referrerPolicy="no-referrer"
          className="w-full flex-1 border-0"
        />
      )}
    </div>
  );
}
