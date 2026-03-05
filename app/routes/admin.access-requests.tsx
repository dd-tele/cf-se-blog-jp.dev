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
import {
  getAllAccessRequests,
  approveAccessRequest,
  rejectAccessRequest,
  deleteAccessRequest,
  addEmailToAccessPolicy,
} from "~/lib/access-requests.server";

export const meta: MetaFunction = () => [
  { title: "投稿者申請管理 — Cloudflare Solution Blog" },
];

export async function loader({ request, context }: LoaderFunctionArgs) {
  const user = await requireRole(request, ["admin"]);
  const db = context.cloudflare.env.DB;
  const requests = await getAllAccessRequests(db);
  return { user, requests };
}

export async function action({ request, context }: ActionFunctionArgs) {
  const user = await requireRole(request, ["admin"]);
  const db = context.cloudflare.env.DB;
  const env = context.cloudflare.env;
  const formData = await request.formData();
  const intent = formData.get("intent") as string;
  const requestId = formData.get("requestId") as string;
  const adminNote = (formData.get("admin_note") as string) || undefined;

  if (!requestId) return { error: "申請IDが指定されていません" };

  if (intent === "approve") {
    try {
      const result = await approveAccessRequest(db, requestId, user.id, adminNote);

      // Try to add email to Cloudflare Access policy
      const accessResult = await addEmailToAccessPolicy(env, result.email);
      if (!accessResult.success) {
        return {
          success: true,
          message: `申請を承認し、ユーザーを作成しました。ただし Access ポリシーへの追加に失敗しました: ${accessResult.error}。手動で追加してください。`,
        };
      }

      return {
        success: true,
        message: `申請を承認しました。${result.email} を Access ポリシーに追加しました。`,
      };
    } catch (e: any) {
      return { error: e.message };
    }
  }

  if (intent === "reject") {
    try {
      await rejectAccessRequest(db, requestId, user.id, adminNote);
      return { success: true, message: "申請を却下しました。" };
    } catch (e: any) {
      return { error: e.message };
    }
  }

  if (intent === "delete") {
    try {
      await deleteAccessRequest(db, requestId);
      return { success: true, message: "申請を削除しました。" };
    } catch (e: any) {
      return { error: e.message };
    }
  }

  return { error: "Unknown action" };
}

const STATUS_MAP: Record<string, { label: string; className: string }> = {
  pending: { label: "審査待ち", className: "bg-yellow-100 text-yellow-700" },
  approved: { label: "承認済み", className: "bg-green-100 text-green-700" },
  rejected: { label: "却下", className: "bg-red-100 text-red-700" },
};

export default function AdminAccessRequests() {
  const { user, requests } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const pendingCount = requests.filter((r) => r.status === "pending").length;

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
              <Link to="/admin/access-requests" className="font-medium text-brand-600">
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
          <h1 className="text-2xl font-bold text-gray-900">投稿者申請管理</h1>
          <p className="mt-1 text-sm text-gray-500">
            全 {requests.length} 件（審査待ち {pendingCount} 件）
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

        {requests.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-300 bg-white p-16 text-center">
            <p className="text-lg font-medium text-gray-600">申請はありません</p>
          </div>
        ) : (
          <div className="space-y-4">
            {requests.map((req) => {
              const status = STATUS_MAP[req.status] ?? STATUS_MAP.pending;
              const isExpanded = expandedId === req.id;
              return (
                <div key={req.id} className="rounded-xl border bg-white shadow-sm">
                  {/* Summary row */}
                  <button
                    type="button"
                    onClick={() => setExpandedId(isExpanded ? null : req.id)}
                    className="flex w-full items-center justify-between px-6 py-4 text-left hover:bg-gray-50"
                  >
                    <div className="flex items-center gap-4">
                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${status.className}`}>
                        {status.label}
                      </span>
                      <div>
                        <div className="text-sm font-medium text-gray-900">
                          {req.display_name}
                          {req.nickname && (
                            <span className="ml-2 text-gray-400">({req.nickname})</span>
                          )}
                        </div>
                        <div className="text-xs text-gray-500">{req.email}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {req.company && (
                        <span className="text-xs text-gray-400">{req.company}</span>
                      )}
                      <span className="text-xs text-gray-400">
                        {new Date(req.created_at).toLocaleDateString("ja-JP")}
                      </span>
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className={`text-gray-400 transition-transform ${isExpanded ? "rotate-180" : ""}`}
                      >
                        <path d="m6 9 6 6 6-6" />
                      </svg>
                    </div>
                  </button>

                  {/* Expanded detail */}
                  {isExpanded && (
                    <div className="border-t px-6 py-5">
                      <div className="grid gap-3 sm:grid-cols-2 text-sm">
                        <div>
                          <span className="text-xs font-medium text-gray-400">名前</span>
                          <div className="text-gray-900">{req.display_name}</div>
                        </div>
                        <div>
                          <span className="text-xs font-medium text-gray-400">よみがな</span>
                          <div className="text-gray-900">{req.furigana || "—"}</div>
                        </div>
                        <div>
                          <span className="text-xs font-medium text-gray-400">ニックネーム</span>
                          <div className="text-gray-900">{req.nickname || "—"}</div>
                        </div>
                        <div>
                          <span className="text-xs font-medium text-gray-400">メールアドレス</span>
                          <div className="text-gray-900">{req.email}</div>
                        </div>
                        <div>
                          <span className="text-xs font-medium text-gray-400">所属会社</span>
                          <div className="text-gray-900">{req.company || "—"}</div>
                        </div>
                        <div>
                          <span className="text-xs font-medium text-gray-400">職種</span>
                          <div className="text-gray-900">{req.job_role || "—"}</div>
                        </div>
                        <div>
                          <span className="text-xs font-medium text-gray-400">得意分野</span>
                          <div className="text-gray-900">{req.expertise || "—"}</div>
                        </div>
                        <div>
                          <span className="text-xs font-medium text-gray-400">申請日</span>
                          <div className="text-gray-900">
                            {new Date(req.created_at).toLocaleString("ja-JP")}
                          </div>
                        </div>
                        {req.profile_comment && (
                          <div className="sm:col-span-2">
                            <span className="text-xs font-medium text-gray-400">ひとこと / 申請理由</span>
                            <div className="text-gray-900 whitespace-pre-wrap">{req.profile_comment}</div>
                          </div>
                        )}
                        {req.admin_note && (
                          <div className="sm:col-span-2">
                            <span className="text-xs font-medium text-gray-400">管理者メモ</span>
                            <div className="text-gray-900">{req.admin_note}</div>
                          </div>
                        )}
                      </div>

                      {/* Actions for pending requests */}
                      {req.status === "pending" && (
                        <div className="mt-6 border-t pt-5">
                          <Form method="post" className="space-y-3">
                            <input type="hidden" name="requestId" value={req.id} />
                            <div>
                              <label htmlFor={`note-${req.id}`} className="mb-1 block text-xs font-medium text-gray-500">
                                管理者メモ（任意）
                              </label>
                              <input
                                type="text"
                                id={`note-${req.id}`}
                                name="admin_note"
                                placeholder="メモを追加..."
                                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                              />
                            </div>
                            <div className="flex gap-3">
                              <button
                                type="submit"
                                name="intent"
                                value="approve"
                                disabled={isSubmitting}
                                className="rounded-lg bg-green-600 px-5 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50 transition-colors"
                              >
                                {isSubmitting ? "処理中..." : "承認（Access に追加）"}
                              </button>
                              <button
                                type="submit"
                                name="intent"
                                value="reject"
                                disabled={isSubmitting}
                                className="rounded-lg bg-red-50 px-5 py-2 text-sm font-medium text-red-600 hover:bg-red-100 disabled:opacity-50 transition-colors"
                              >
                                却下
                              </button>
                            </div>
                          </Form>
                        </div>
                      )}

                      {/* Info and actions for processed requests */}
                      {req.status !== "pending" && (
                        <div className="mt-4 flex items-center justify-between border-t pt-4">
                          {req.reviewed_at && (
                            <span className="text-xs text-gray-400">
                              {req.status === "approved" ? "承認" : "却下"}日: {new Date(req.reviewed_at).toLocaleString("ja-JP")}
                            </span>
                          )}
                          <Form method="post">
                            <input type="hidden" name="requestId" value={req.id} />
                            <button
                              type="submit"
                              name="intent"
                              value="delete"
                              disabled={isSubmitting}
                              onClick={(e) => {
                                if (!confirm("この申請を削除しますか？")) e.preventDefault();
                              }}
                              className="rounded-lg bg-gray-100 px-3 py-1.5 text-xs font-medium text-gray-500 hover:bg-red-50 hover:text-red-600 transition-colors disabled:opacity-50"
                            >
                              削除
                            </button>
                          </Form>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
