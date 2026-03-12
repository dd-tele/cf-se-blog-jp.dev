import { useEffect } from "react";
import type { LoaderFunctionArgs, MetaFunction } from "@remix-run/cloudflare";
import { useLoaderData, Link } from "@remix-run/react";
import { getPostBySlug, getPostSummary, incrementViewCount } from "~/lib/posts.server";
import { getSessionUser } from "~/lib/auth.server";
import { renderMarkdown } from "~/lib/markdown.server";
import { findRelatedPosts } from "~/lib/vectorize.server";
import { ChatWidget } from "~/components/ChatWidget";

export const meta: MetaFunction<typeof loader> = ({ data }) => {
  if (!data?.post) return [{ title: "記事が見つかりません" }];
  const p = data.post;
  const title = `${p.metaTitle || p.title} — Cloudflare Solution Blog`;
  const description = p.metaDescription || p.excerpt || "";
  const url = `${data.siteUrl}/posts/${p.slug}`;
  const image = p.coverImageUrl || "";

  return [
    { title },
    { name: "description", content: description },
    // Open Graph
    { property: "og:type", content: "article" },
    { property: "og:title", content: title },
    { property: "og:description", content: description },
    { property: "og:url", content: url },
    ...(image ? [{ property: "og:image", content: image }] : []),
    { property: "og:site_name", content: "Cloudflare Solution Blog" },
    ...(p.publishedAt
      ? [{ property: "article:published_time", content: p.publishedAt }]
      : []),
    // Twitter Card
    { name: "twitter:card", content: image ? "summary_large_image" : "summary" },
    { name: "twitter:title", content: title },
    { name: "twitter:description", content: description },
    ...(image ? [{ name: "twitter:image", content: image }] : []),
  ];
};

export async function loader({ params, context, request }: LoaderFunctionArgs) {
  const slug = params.slug;
  if (!slug) throw new Response("Not Found", { status: 404 });

  const db = context.cloudflare.env.DB;
  const post = await getPostBySlug(db, slug);

  if (!post || (post.status !== "published")) {
    // Allow author/admin to preview
    const user = await getSessionUser(request);
    if (!post || (!user || (user.id !== post.authorId && user.role !== "admin"))) {
      throw new Response("Not Found", { status: 404 });
    }
  }

  // Fire-and-forget view count increment
  incrementViewCount(db, post.id).catch(() => {});

  const ai = context.cloudflare.env.AI;
  const vectorize = context.cloudflare.env.VECTORIZE;

  const [user, summaryRow] = await Promise.all([
    getSessionUser(request),
    getPostSummary(db, post.id),
  ]);

  const aiSummary = summaryRow
    ? {
        summary: summaryRow.summary,
        keyPoints: summaryRow.keyPointsJson
          ? (JSON.parse(summaryRow.keyPointsJson) as string[])
          : [],
      }
    : null;

  // Related posts via Vectorize (non-blocking, fallback to empty)
  let relatedPosts: { id: string; score: number; title: string }[] = [];
  if (ai && vectorize && post.status === "published") {
    try {
      relatedPosts = await findRelatedPosts(ai, vectorize, post.id, post.title, post.content, 4);
    } catch { /* ignore */ }
  }

  // Convert Markdown content to HTML
  const contentHtml = renderMarkdown(post.content);

  return {
    post: { ...post, contentHtml },
    user,
    aiSummary,
    relatedPosts,
    siteName: context.cloudflare.env.SITE_NAME ?? "Cloudflare Solution Blog",
    siteUrl: context.cloudflare.env.SITE_URL ?? "https://cf-se-blog-jp.dev",
    turnstileSiteKey: context.cloudflare.env.TURNSTILE_SITE_KEY ?? "",
  };
}

export default function PostDetail() {
  const { post, user, aiSummary, relatedPosts, siteName, turnstileSiteKey } = useLoaderData<typeof loader>();

  const tags: string[] = post.tagsJson ? JSON.parse(post.tagsJson) : [];

  // Initialize Mermaid.js for diagram rendering
  useEffect(() => {
    const nodes = document.querySelectorAll("pre.mermaid");
    if (nodes.length === 0) return;

    let cancelled = false;

    function initMermaid() {
      if (cancelled) return;
      const m = (window as any).mermaid;
      if (!m) return;
      m.initialize({
        startOnLoad: false,
        theme: "neutral",
        securityLevel: "loose",
        fontFamily: "ui-sans-serif, system-ui, sans-serif",
      });
      m.run({ nodes });
    }

    // If already loaded (e.g. client-side navigation)
    if ((window as any).mermaid) {
      initMermaid();
      return () => { cancelled = true; };
    }

    // Load via script tag
    const script = document.createElement("script");
    script.src = "https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.min.js";
    script.onload = initMermaid;
    script.onerror = () => console.warn("Failed to load Mermaid.js");
    document.head.appendChild(script);

    return () => {
      cancelled = true;
    };
  }, [post.contentHtml]);

  return (
    <div className="flex min-h-screen flex-col">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b bg-white/80 backdrop-blur-sm">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link to="/" className="text-lg font-bold text-gray-900 hover:text-brand-600 transition-colors">
            {siteName}
          </Link>
          <nav className="flex items-center gap-4">
            <Link
              to="/posts"
              className="text-sm text-gray-600 hover:text-gray-900"
            >
              記事一覧
            </Link>
            <Link
              to="/about"
              className="text-sm text-gray-600 hover:text-gray-900"
            >
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

      <main className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
        <Link to="/posts" className="mb-6 inline-flex items-center text-sm text-gray-500 hover:text-gray-700">
          ← 事例一覧に戻る
        </Link>

        {/* Status banner for non-published */}
        {post.status !== "published" && (
          <div className="mb-6 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-700">
            この記事はまだ公開されていません（ステータス: {post.status}）
          </div>
        )}

        {/* Cover Image */}
        {post.coverImageUrl && (
          <div className="mb-8 overflow-hidden rounded-2xl">
            <img
              src={post.coverImageUrl}
              alt={post.title}
              className="h-auto w-full object-cover"
            />
          </div>
        )}

        {/* Category + Meta */}
        <div className="mb-4 flex flex-wrap items-center gap-3 text-sm text-gray-500">
          {post.categoryName && (
            <Link
              to={`/posts?category=${post.categorySlug}`}
              className="rounded-full bg-brand-50 px-3 py-1 text-xs font-medium text-brand-700 hover:bg-brand-100"
            >
              {post.categoryName}
            </Link>
          )}
          {post.publishedAt && (
            <span>
              {new Date(post.publishedAt).toLocaleDateString("ja-JP", {
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </span>
          )}
          {post.readingTimeMinutes && (
            <span>読了 {post.readingTimeMinutes}分</span>
          )}
          <span>{post.viewCount?.toLocaleString()} views</span>
        </div>

        {/* Title */}
        <h1 className="mb-6 text-3xl font-bold leading-tight text-gray-900 sm:text-4xl">
          {post.title}
        </h1>

        {/* Author */}
        <div className="mb-8 flex items-center gap-3 border-b pb-6">
          <Link to={`/authors/${post.authorId}`} className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-100 text-brand-700 hover:ring-2 hover:ring-brand-300 transition-all">
            {post.authorAvatar ? (
              <img
                src={post.authorAvatar}
                alt={post.authorName ?? ""}
                className="h-10 w-10 rounded-full"
              />
            ) : (
              <span className="text-sm font-bold">
                {post.authorName?.charAt(0) ?? "?"}
              </span>
            )}
          </Link>
          <div>
            <Link to={`/authors/${post.authorId}`} className="font-medium text-gray-900 hover:text-brand-600 transition-colors">{post.authorName}</Link>
            <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500">
              {post.authorCompany && <span><span className="text-gray-400">所属:</span> {post.authorCompany}</span>}
              {post.authorCompany && post.authorExpertise && <span className="text-gray-300">|</span>}
              {post.authorExpertise && <span><span className="text-gray-400">得意分野:</span> {post.authorExpertise}</span>}
            </div>
          </div>
        </div>

        {/* AI Summary */}
        {aiSummary && (
          <div className="mb-8 rounded-xl border border-brand-100 bg-brand-50/50 p-5">
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-widest text-brand-600">
              AI Summary
            </h2>
            <p className="text-sm leading-relaxed text-gray-700">
              {aiSummary.summary}
            </p>
            {aiSummary.keyPoints.length > 0 && (
              <ul className="mt-3 space-y-1">
                {aiSummary.keyPoints.map((point, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-gray-600">
                    <span className="mt-1.5 h-1 w-1 flex-shrink-0 rounded-full bg-brand-400" />
                    {point}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {/* Content */}
        <article className="prose prose-lg prose-gray max-w-none prose-headings:font-bold prose-headings:text-gray-900 prose-p:leading-relaxed prose-a:text-brand-600 prose-a:no-underline hover:prose-a:underline prose-blockquote:border-l-brand-400 prose-blockquote:text-gray-600 prose-code:rounded prose-code:bg-gray-100 prose-code:px-1.5 prose-code:py-0.5 prose-code:text-sm prose-code:before:content-none prose-code:after:content-none prose-pre:bg-gray-900 prose-pre:text-gray-100 prose-img:rounded-xl prose-img:shadow-md prose-table:text-sm prose-th:bg-gray-50 prose-th:px-4 prose-th:py-2 prose-td:px-4 prose-td:py-2">
          <div dangerouslySetInnerHTML={{ __html: post.contentHtml }} />
        </article>

        {/* Tags */}
        {tags.length > 0 && (
          <div className="mt-8 flex flex-wrap gap-2 border-t pt-6">
            {tags.map((tag) => (
              <Link
                key={tag}
                to={`/posts?q=${encodeURIComponent(tag)}`}
                className="rounded-full bg-gray-100 px-3 py-1 text-xs text-gray-600 hover:bg-gray-200"
              >
                #{tag}
              </Link>
            ))}
          </div>
        )}

        {/* Related posts */}
        {relatedPosts.length > 0 && (
          <div className="mt-10 border-t pt-8">
            <h2 className="mb-4 text-xs font-semibold uppercase tracking-widest text-gray-400">
              Related Articles
            </h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {relatedPosts.map((rp) => (
                <Link
                  key={rp.id}
                  to={`/posts/${rp.id}`}
                  className="rounded-lg border border-gray-200 bg-white p-4 text-sm font-medium text-gray-900 transition-all hover:border-gray-400 hover:shadow-sm"
                >
                  {rp.title}
                  <span className="mt-1 block text-xs text-gray-400">
                    関連度: {Math.round(rp.score * 100)}%
                  </span>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Edit link for author */}
        {user && (user.id === post.authorId || user.role === "admin") && (
          <div className="mt-6 border-t pt-6">
            <Link
              to={`/portal/edit/${post.id}`}
              className="rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200"
            >
              この記事を編集する
            </Link>
          </div>
        )}
      </main>

      {/* AI Chat Widget */}
      {post.status === "published" && (
        <ChatWidget postId={post.id} postTitle={post.title} turnstileSiteKey={turnstileSiteKey} />
      )}

      {/* Footer */}
      <footer className="mt-auto border-t bg-gray-900 py-8 text-gray-400">
        <div className="mx-auto max-w-7xl px-4 text-center text-sm sm:px-6 lg:px-8">
          Built with 100% Cloudflare Stack
        </div>
      </footer>
    </div>
  );
}
