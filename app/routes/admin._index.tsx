import { useState } from "react";
import type {
  LoaderFunctionArgs,
  MetaFunction,
} from "@remix-run/cloudflare";
import { useLoaderData, Link } from "@remix-run/react";
import { requireRole } from "~/lib/auth.server";
import { getAllDraftPosts } from "~/lib/posts.server";
import { renderMarkdown } from "~/lib/markdown.server";

export const meta: MetaFunction = () => [
  { title: "管理画面 — Cloudflare Solution Blog" },
];

export async function loader({ request, context }: LoaderFunctionArgs) {
  const user = await requireRole(request, ["admin"]);
  const db = context.cloudflare.env.DB;
  const drafts = await getAllDraftPosts(db);
  const draftPosts = drafts.map((p) => ({
    ...p,
    contentHtml: renderMarkdown(p.content),
  }));
  return { user, draftPosts };
}

export default function AdminIndex() {
  const { user, draftPosts } = useLoaderData<typeof loader>();

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
              <Link
                to="/admin"
                className="font-medium text-brand-600"
              >
                下書き一覧
              </Link>
              <Link
                to="/admin/ai-insights"
                className="text-gray-500 hover:text-gray-700"
              >
                AI インサイト
              </Link>
              <Link
                to="/admin/qa"
                className="text-gray-500 hover:text-gray-700"
              >
                Q&A 管理
              </Link>
              <Link
                to="/portal"
                className="text-gray-500 hover:text-gray-700"
              >
                ポータル
              </Link>
            </nav>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-500">{user.displayName}</span>
            <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
              {user.role}
            </span>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">下書き一覧</h1>
            <p className="mt-1 text-sm text-gray-500">
              全ユーザーの下書き記事が {draftPosts.length} 件あります（閲覧専用）
            </p>
          </div>
        </div>

        {draftPosts.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-300 bg-white p-16 text-center">
            <div className="text-4xl">📝</div>
            <p className="mt-4 text-lg font-medium text-gray-600">
              下書きの記事はありません
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {draftPosts.map((post) => (
              <div
                key={post.id}
                className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm"
              >
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-gray-900">
                    {post.title}
                  </h3>
                  <div className="mt-2 flex items-center gap-3 text-sm text-gray-500">
                    <span>著者: {post.authorName}</span>
                    {post.categoryName && (
                      <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs">
                        {post.categoryName}
                      </span>
                    )}
                    <span>
                      更新: {new Date(post.updatedAt).toLocaleDateString("ja-JP")}
                    </span>
                  </div>
                  {post.excerpt && (
                    <p className="mt-2 text-sm text-gray-500 line-clamp-2">
                      {post.excerpt}
                    </p>
                  )}
                  <ContentPreview contentHtml={post.contentHtml} />
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

function ContentPreview({ contentHtml }: { contentHtml: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mt-3">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="text-xs font-medium text-brand-600 hover:text-brand-700"
      >
        {open ? "▼ プレビューを閉じる" : "▶ 記事をプレビュー"}
      </button>
      {open && (
        <div className="mt-3 max-h-[600px] overflow-y-auto rounded-lg border border-gray-200 bg-white p-6">
          <article className="prose prose-sm prose-gray max-w-none prose-headings:font-bold prose-a:text-brand-600 prose-code:rounded prose-code:bg-gray-100 prose-code:px-1 prose-code:py-0.5 prose-code:text-xs prose-code:before:content-none prose-code:after:content-none prose-pre:bg-gray-900 prose-pre:text-gray-100 prose-img:rounded-lg">
            <div dangerouslySetInnerHTML={{ __html: contentHtml }} />
          </article>
        </div>
      )}
    </div>
  );
}
