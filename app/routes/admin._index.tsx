import { useState } from "react";
import type {
  ActionFunctionArgs,
  LoaderFunctionArgs,
  MetaFunction,
} from "@remix-run/cloudflare";
import { useLoaderData, useActionData, Link, Form, useNavigation } from "@remix-run/react";
import { requireRole } from "~/lib/auth.server";
import { getAllPostsForAdmin, deletePost } from "~/lib/posts.server";

export const meta: MetaFunction = () => [
  { title: "投稿管理 — Cloudflare Solution Blog" },
];

export async function loader({ request, context }: LoaderFunctionArgs) {
  const user = await requireRole(request, ["admin"]);
  const db = context.cloudflare.env.DB;
  const allPosts = await getAllPostsForAdmin(db);
  return { user, allPosts };
}

export async function action({ request, context }: ActionFunctionArgs) {
  const user = await requireRole(request, ["admin"]);
  const db = context.cloudflare.env.DB;
  const formData = await request.formData();
  const intent = formData.get("intent") as string;

  if (intent === "delete") {
    const postId = formData.get("postId") as string;
    if (!postId) return { error: "投稿IDが指定されていません" };
    try {
      await deletePost(db, postId, user);
      return { success: true, deletedId: postId };
    } catch (e) {
      return { error: e instanceof Error ? e.message : "削除に失敗しました" };
    }
  }

  return { error: "Unknown action" };
}

export default function AdminIndex() {
  const { user, allPosts } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const isDeleting = navigation.state === "submitting";

  const draftCount = allPosts.filter((p) => p.status === "draft").length;
  const publishedCount = allPosts.filter((p) => p.status === "published").length;

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
              <Link to="/admin" className="font-medium text-brand-600">
                投稿管理
              </Link>
              <Link to="/admin/access-requests" className="text-gray-500 hover:text-gray-700">
                投稿者申請
              </Link>
              <Link to="/admin/users" className="text-gray-500 hover:text-gray-700">
                ユーザー管理
              </Link>
              <Link to="/admin/ai-insights" className="text-gray-500 hover:text-gray-700">
                AI インサイト
              </Link>
              <Link to="/admin/qa" className="text-gray-500 hover:text-gray-700">
                Q&A 管理
              </Link>
              <Link to="/admin/presentation" className="text-gray-500 hover:text-gray-700">
                プレゼン
              </Link>
              <Link to="/portal" className="text-gray-500 hover:text-gray-700">
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
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">投稿管理</h1>
            <p className="mt-1 text-sm text-gray-500">
              全 {allPosts.length} 件（公開 {publishedCount} / 下書き {draftCount}）
            </p>
          </div>
        </div>

        {actionData && "error" in actionData && actionData.error && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {actionData.error}
          </div>
        )}
        {actionData && "success" in actionData && actionData.success && (
          <div className="mb-4 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
            投稿を削除しました
          </div>
        )}

        {allPosts.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-300 bg-white p-16 text-center">
            <div className="text-4xl">📝</div>
            <p className="mt-4 text-lg font-medium text-gray-600">
              投稿がありません
            </p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border bg-white">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">タイトル</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">著者</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">カテゴリ</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">ステータス</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">更新日</th>
                  <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {allPosts.map((post) => (
                  <tr key={post.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="text-sm font-medium text-gray-900 max-w-xs truncate">
                        <Link to={`/posts/${post.slug}`} className="hover:text-brand-600">
                          {post.title}
                        </Link>
                        {post.status === "draft" && (
                          <span className="ml-2 text-[10px] text-gray-400">(プレビュー可)</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500 whitespace-nowrap">
                      {post.authorName}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500 whitespace-nowrap">
                      {post.categoryName ?? "-"}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        post.status === "published"
                          ? "bg-green-100 text-green-700"
                          : "bg-yellow-100 text-yellow-700"
                      }`}>
                        {post.status === "published" ? "公開" : "下書き"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-400 whitespace-nowrap">
                      {new Date(post.updatedAt).toLocaleDateString("ja-JP")}
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      {confirmId === post.id ? (
                        <div className="flex items-center justify-end gap-2">
                          <span className="text-xs text-red-600 font-medium">削除しますか？</span>
                          <Form method="post" className="inline">
                            <input type="hidden" name="intent" value="delete" />
                            <input type="hidden" name="postId" value={post.id} />
                            <button
                              type="submit"
                              disabled={isDeleting}
                              className="rounded bg-red-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50"
                            >
                              {isDeleting ? "削除中..." : "はい、削除"}
                            </button>
                          </Form>
                          <button
                            type="button"
                            onClick={() => setConfirmId(null)}
                            className="rounded bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-200"
                          >
                            キャンセル
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-end gap-2">
                          <Link
                            to={`/posts/${post.slug}`}
                            className="rounded bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-600 hover:bg-blue-100"
                          >
                            表示
                          </Link>
                          <Link
                            to={`/portal/edit/${post.id}`}
                            className="rounded bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-200"
                          >
                            編集
                          </Link>
                          <button
                            type="button"
                            onClick={() => setConfirmId(post.id)}
                            className="rounded bg-red-50 px-2.5 py-1 text-xs font-medium text-red-600 hover:bg-red-100"
                          >
                            削除
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  );
}
