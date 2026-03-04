import type { LoaderFunctionArgs, MetaFunction } from "@remix-run/cloudflare";
import { useLoaderData, Link } from "@remix-run/react";
import { requireUser } from "~/lib/auth.server";
import { getUserPosts } from "~/lib/posts.server";

export const meta: MetaFunction = () => [
  { title: "マイ記事 — Cloudflare Solution Blog" },
];

export async function loader({ request, context }: LoaderFunctionArgs) {
  const user = await requireUser(request);
  const db = context.cloudflare.env.DB;
  const url = new URL(request.url);
  const statusFilter = url.searchParams.get("status") ?? "all";
  const postsList = await getUserPosts(db, user.id, statusFilter);
  return { user, posts: postsList, statusFilter };
}

const STATUS_LABELS: Record<string, { label: string; className: string }> = {
  draft: { label: "下書き", className: "bg-gray-100 text-gray-700" },
  published: { label: "公開", className: "bg-green-100 text-green-700" },
  archived: { label: "アーカイブ", className: "bg-gray-100 text-gray-500" },
};

export default function PortalPosts() {
  const { user, posts, statusFilter } = useLoaderData<typeof loader>();

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b bg-white">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-4">
            <Link to="/" className="text-lg font-bold text-gray-900 hover:text-brand-600 transition-colors">
              Cloudflare Solution Blog
            </Link>
            <span className="text-sm text-gray-400">|</span>
            <Link to="/portal" className="text-sm text-gray-500 hover:text-gray-700">
              ← ダッシュボード
            </Link>
          </div>
          <Link
            to="/portal/new"
            className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600 transition-colors"
          >
            新しい記事
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <h1 className="mb-6 text-2xl font-bold text-gray-900">マイ記事</h1>

        {/* Status filter */}
        <div className="mb-6 flex flex-wrap gap-2">
          {[
            { value: "all", label: "すべて" },
            { value: "draft", label: "下書き" },
            { value: "published", label: "公開" },
          ].map((f) => (
            <Link
              key={f.value}
              to={`/portal/posts?status=${f.value}`}
              className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                statusFilter === f.value
                  ? "bg-brand-500 text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {f.label}
            </Link>
          ))}
        </div>

        {posts.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-300 bg-white p-12 text-center">
            <p className="text-gray-500">記事がありません</p>
            <Link
              to="/portal/new"
              className="mt-4 inline-block rounded-lg bg-brand-500 px-6 py-2 text-sm font-medium text-white hover:bg-brand-600 transition-colors"
            >
              最初の記事を書く
            </Link>
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
            <table className="w-full">
              <thead className="border-b bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                    タイトル
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                    カテゴリ
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                    ステータス
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                    閲覧数
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                    更新日
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {posts.map((post) => {
                  const statusInfo = STATUS_LABELS[post.status] ?? {
                    label: post.status,
                    className: "bg-gray-100 text-gray-700",
                  };
                  return (
                    <tr key={post.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <Link
                          to={
                            post.status === "published"
                              ? `/posts/${post.slug}`
                              : `/portal/edit/${post.id}`
                          }
                          className="font-medium text-gray-900 hover:text-brand-600"
                        >
                          {post.title}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500">
                        {post.categoryName ?? "—"}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${statusInfo.className}`}
                        >
                          {statusInfo.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500">
                        {post.viewCount}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500">
                        {new Date(post.updatedAt).toLocaleDateString("ja-JP")}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  );
}
