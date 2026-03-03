import { useState } from "react";
import type {
  ActionFunctionArgs,
  LoaderFunctionArgs,
  MetaFunction,
} from "@remix-run/cloudflare";
import { useLoaderData, Form, Link, useNavigation } from "@remix-run/react";
import { requireRole } from "~/lib/auth.server";
import { getPendingPosts, approvePost, rejectPost, getPostById } from "~/lib/posts.server";
import { renderMarkdown } from "~/lib/markdown.server";
import { generatePostSummary } from "~/lib/ai.server";
import { indexPost } from "~/lib/vectorize.server";
import { writeAuditLog } from "~/lib/audit.server";
import { checkPostMilestones } from "~/lib/badges.server";

export const meta: MetaFunction = () => [
  { title: "管理画面 — Cloudflare Solution Blog" },
];

export async function loader({ request, context }: LoaderFunctionArgs) {
  const user = await requireRole(request, ["admin", "se"]);
  const db = context.cloudflare.env.DB;
  const pending = await getPendingPosts(db);
  const pendingPosts = pending.map((p) => ({
    ...p,
    contentHtml: renderMarkdown(p.content),
  }));
  return { user, pendingPosts };
}

export async function action({ request, context }: ActionFunctionArgs) {
  const user = await requireRole(request, ["admin"]);
  const db = context.cloudflare.env.DB;
  const formData = await request.formData();
  const postId = formData.get("postId") as string;
  const actionType = formData.get("action") as string;

  if (!postId) return { error: "Post ID is required" };

  const ip = request.headers.get("CF-Connecting-IP") || undefined;

  if (actionType === "approve") {
    await approvePost(db, postId, user.id);
    writeAuditLog(db, { userId: user.id, action: "post.approve", resourceType: "post", resourceId: postId, ip }).catch(() => {});
    const ai = context.cloudflare.env.AI;
    const post = await getPostById(db, postId);
    if (post) {
      // Fire-and-forget badge milestone check
      checkPostMilestones(db, post.author_id).catch(() => {});
      if (ai) {
        // Fire-and-forget AI summary generation
        generatePostSummary(ai, db, postId, post.title, post.content).catch(
          (e) => console.error("AI summary failed:", e)
        );
        // Fire-and-forget Vectorize indexing
        const vectorize = context.cloudflare.env.VECTORIZE;
        if (vectorize) {
          const tags: string[] = post.tags_json ? JSON.parse(post.tags_json) : [];
          indexPost(ai, vectorize, { id: postId, title: post.title, content: post.content, tags }).catch(
            (e) => console.error("Vectorize indexing failed:", e)
          );
        }
      }
    }
  } else if (actionType === "reject") {
    await rejectPost(db, postId, user.id);
    writeAuditLog(db, { userId: user.id, action: "post.reject", resourceType: "post", resourceId: postId, ip }).catch(() => {});
  }

  return { success: true };
}

export default function AdminIndex() {
  const { user, pendingPosts } = useLoaderData<typeof loader>();
  const navigation = useNavigation();
  const isProcessing = navigation.state === "submitting";

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
                承認キュー
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
            <h1 className="text-2xl font-bold text-gray-900">承認キュー</h1>
            <p className="mt-1 text-sm text-gray-500">
              レビュー待ちの記事が {pendingPosts.length} 件あります
            </p>
          </div>
        </div>

        {pendingPosts.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-300 bg-white p-16 text-center">
            <div className="text-4xl">✅</div>
            <p className="mt-4 text-lg font-medium text-gray-600">
              レビュー待ちの記事はありません
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {pendingPosts.map((post) => (
              <div
                key={post.id}
                className="flex items-start justify-between rounded-xl border border-gray-200 bg-white p-6 shadow-sm"
              >
                <div className="flex-1">
                  <Link
                    to={`/posts/${post.slug}`}
                    className="text-lg font-semibold text-gray-900 hover:text-brand-600"
                  >
                    {post.title}
                  </Link>
                  <div className="mt-2 flex items-center gap-3 text-sm text-gray-500">
                    <span>著者: {post.authorName}</span>
                    {post.categoryName && (
                      <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs">
                        {post.categoryName}
                      </span>
                    )}
                    <span>
                      {new Date(post.createdAt).toLocaleDateString("ja-JP")}
                    </span>
                  </div>
                  {post.excerpt && (
                    <p className="mt-2 text-sm text-gray-500 line-clamp-2">
                      {post.excerpt}
                    </p>
                  )}
                  <ContentPreview contentHtml={post.contentHtml} />
                </div>

                {user.role === "admin" && (
                  <div className="ml-6 flex gap-2">
                    <Form method="post">
                      <input type="hidden" name="postId" value={post.id} />
                      <input type="hidden" name="action" value="approve" />
                      <button
                        type="submit"
                        disabled={isProcessing}
                        className="rounded-lg bg-green-500 px-4 py-2 text-sm font-medium text-white hover:bg-green-600 disabled:opacity-50 transition-colors"
                      >
                        承認
                      </button>
                    </Form>
                    <Form method="post">
                      <input type="hidden" name="postId" value={post.id} />
                      <input type="hidden" name="action" value="reject" />
                      <button
                        type="submit"
                        disabled={isProcessing}
                        className="rounded-lg bg-red-500 px-4 py-2 text-sm font-medium text-white hover:bg-red-600 disabled:opacity-50 transition-colors"
                      >
                        差戻し
                      </button>
                    </Form>
                  </div>
                )}
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
