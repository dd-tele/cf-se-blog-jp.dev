import { useState } from "react";
import type {
  ActionFunctionArgs,
  LoaderFunctionArgs,
  MetaFunction,
} from "@remix-run/cloudflare";
import {
  useLoaderData,
  useActionData,
  Link,
  Form,
  useNavigation,
} from "@remix-run/react";
import { requireRole } from "~/lib/auth.server";
import { getAllUsers, deleteUser, removeEmailFromAccessPolicy } from "~/lib/access-requests.server";

export const meta: MetaFunction = () => [
  { title: "ユーザー管理 — Cloudflare Solution Blog" },
];

export async function loader({ request, context }: LoaderFunctionArgs) {
  const user = await requireRole(request, ["admin"]);
  const db = context.cloudflare.env.DB;
  const allUsers = await getAllUsers(db);
  return { user, allUsers };
}

export async function action({ request, context }: ActionFunctionArgs) {
  await requireRole(request, ["admin"]);
  const db = context.cloudflare.env.DB;
  const formData = await request.formData();
  const intent = formData.get("intent") as string;

  if (intent === "delete") {
    const userId = formData.get("userId") as string;
    if (!userId) return { error: "ユーザーIDが指定されていません" };
    try {
      const env = context.cloudflare.env;
      const result = await deleteUser(db, userId);
      // Remove email from Cloudflare Access policy
      const accessResult = await removeEmailFromAccessPolicy(env, result.email);
      if (!accessResult.success) {
        return {
          success: true,
          message: `ユーザーを削除しました。ただし Access ポリシーからのメール削除に失敗しました: ${accessResult.error}`,
        };
      }
      return { success: true, message: "ユーザーを削除し、Access ポリシーからメールも削除しました" };
    } catch (e: any) {
      return { error: e.message };
    }
  }

  return { error: "Unknown action" };
}

const ROLE_STYLES: Record<string, { label: string; className: string }> = {
  admin: { label: "Admin", className: "bg-red-100 text-red-700" },
  se: { label: "SE", className: "bg-blue-100 text-blue-700" },
  user: { label: "User", className: "bg-green-100 text-green-700" },
};

export default function AdminUsers() {
  const { user, allUsers } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const isDeleting = navigation.state === "submitting";
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const activeCount = allUsers.filter((u) => u.is_active).length;

  return (
    <div className="min-h-screen bg-gray-50">
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
              <Link to="/admin" className="text-gray-500 hover:text-gray-700">
                投稿管理
              </Link>
              <Link to="/admin/access-requests" className="text-gray-500 hover:text-gray-700">
                投稿者申請
              </Link>
              <Link to="/admin/users" className="font-medium text-brand-600">
                ユーザー管理
              </Link>
              <Link to="/admin/ai-insights" className="text-gray-500 hover:text-gray-700">
                AI インサイト
              </Link>
              <Link to="/admin/qa" className="text-gray-500 hover:text-gray-700">
                Q&A 管理
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
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">ユーザー管理</h1>
          <p className="mt-1 text-sm text-gray-500">
            全 {allUsers.length} 名（アクティブ {activeCount} 名）
          </p>
        </div>

        {actionData && "error" in actionData && actionData.error && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {actionData.error}
          </div>
        )}
        {actionData && "success" in actionData && (
          <div className="mb-4 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
            {actionData.message}
          </div>
        )}

        {allUsers.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-300 bg-white p-16 text-center">
            <p className="text-lg font-medium text-gray-600">ユーザーがいません</p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border bg-white">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">名前</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">メール</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">所属</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">ロール</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">状態</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">登録日</th>
                  <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {allUsers.map((u) => {
                  const roleStyle = ROLE_STYLES[u.role] ?? ROLE_STYLES.user;
                  const isSelf = u.id === user.id;
                  return (
                    <tr key={u.id} className={`hover:bg-gray-50 ${!u.is_active ? "opacity-50" : ""}`}>
                      <td className="px-4 py-3">
                        <div className="text-sm font-medium text-gray-900">
                          {u.nickname || u.display_name}
                        </div>
                        {u.nickname && (
                          <div className="text-xs text-gray-400">{u.display_name}</div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500 whitespace-nowrap">
                        {u.email}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500 whitespace-nowrap">
                        {u.company || "—"}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${roleStyle.className}`}>
                          {roleStyle.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${u.is_active ? "bg-green-50 text-green-600" : "bg-gray-100 text-gray-500"}`}>
                          {u.is_active ? "有効" : "無効"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-400 whitespace-nowrap">
                        {new Date(u.created_at).toLocaleDateString("ja-JP")}
                      </td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        {confirmId === u.id ? (
                          <div className="flex items-center justify-end gap-2">
                            <span className="text-xs text-red-600 font-medium">削除しますか？</span>
                            <Form method="post" className="inline">
                              <input type="hidden" name="intent" value="delete" />
                              <input type="hidden" name="userId" value={u.id} />
                              <button
                                type="submit"
                                disabled={isDeleting}
                                className="rounded bg-red-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50"
                              >
                                {isDeleting ? "削除中..." : "はい"}
                              </button>
                            </Form>
                            <button
                              type="button"
                              onClick={() => setConfirmId(null)}
                              className="rounded bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-200"
                            >
                              いいえ
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center justify-end gap-2">
                            <Link
                              to={`/admin/users/${u.id}`}
                              className="rounded bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-200"
                            >
                              編集
                            </Link>
                            {!isSelf && (
                              <button
                                type="button"
                                onClick={() => setConfirmId(u.id)}
                                className="rounded bg-red-50 px-2.5 py-1 text-xs font-medium text-red-600 hover:bg-red-100"
                              >
                                削除
                              </button>
                            )}
                          </div>
                        )}
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
