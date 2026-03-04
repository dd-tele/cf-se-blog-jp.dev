import type {
  ActionFunctionArgs,
  LoaderFunctionArgs,
  MetaFunction,
} from "@remix-run/cloudflare";
import { useLoaderData, Link, Form, useNavigation, useSearchParams } from "@remix-run/react";
import { requireRole } from "~/lib/auth.server";
import {
  listThreads,
  getThreadMessages,
  getFlaggedMessages,
  updateThreadStatus,
  saveMessage,
} from "~/lib/chat.server";
import { writeAuditLog } from "~/lib/audit.server";

export const meta: MetaFunction = () => [
  { title: "Q&A 管理 — Cloudflare Solution Blog" },
];

export async function loader({ request, context }: LoaderFunctionArgs) {
  const user = await requireRole(request, ["admin", "se"]);
  const db = context.cloudflare.env.DB;
  const url = new URL(request.url);
  const status = url.searchParams.get("status") ?? "all";
  const threadId = url.searchParams.get("thread");

  const threads = await listThreads(db, { status, limit: 30 });
  const flagged = await getFlaggedMessages(db, 20);

  let activeThread: {
    id: string;
    messages: Awaited<ReturnType<typeof getThreadMessages>>;
  } | null = null;

  if (threadId) {
    const messages = await getThreadMessages(db, threadId, 100);
    activeThread = { id: threadId, messages };
  }

  return { user, threads, flagged, activeThread, currentStatus: status };
}

export async function action({ request, context }: ActionFunctionArgs) {
  const user = await requireRole(request, ["admin", "se"]);
  const db = context.cloudflare.env.DB;
  const formData = await request.formData();
  const intent = formData.get("intent") as string;

  if (intent === "update-status") {
    const threadId = formData.get("threadId") as string;
    const newStatus = formData.get("status") as "active" | "resolved" | "flagged";
    if (threadId && newStatus) {
      await updateThreadStatus(db, threadId, newStatus);
      const action = newStatus === "resolved" ? "thread.resolve" as const : "thread.flag" as const;
      writeAuditLog(db, { userId: user.id, action, resourceType: "thread", resourceId: threadId }).catch(() => {});
    }
  }

  if (intent === "reply") {
    const threadId = formData.get("threadId") as string;
    const content = formData.get("content") as string;
    if (threadId && content?.trim()) {
      await saveMessage(db, threadId, {
        role: user.role === "admin" ? "admin" : "se",
        content: content.trim(),
        userId: user.id,
      });
      writeAuditLog(db, { userId: user.id, action: "chat.reply", resourceType: "thread", resourceId: threadId }).catch(() => {});
    }
  }

  return { success: true };
}

export default function AdminQA() {
  const { user, threads, flagged, activeThread, currentStatus } =
    useLoaderData<typeof loader>();
  const navigation = useNavigation();
  const [searchParams] = useSearchParams();
  const isBusy = navigation.state !== "idle";

  const statusFilters = [
    { value: "all", label: "すべて" },
    { value: "active", label: "アクティブ" },
    { value: "resolved", label: "解決済み" },
    { value: "flagged", label: "フラグ付き" },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="border-b bg-white">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-4">
            <Link
              to="/"
              className="text-lg font-bold text-gray-900 hover:text-brand-600 transition-colors"
            >
              Cloudflare Solution Blog
            </Link>
            <span className="text-sm text-gray-400">|</span>
            <span className="text-sm font-semibold text-red-600">Admin</span>
            <span className="text-sm text-gray-400">|</span>
            <nav className="flex items-center gap-4 text-sm">
              <Link to="/admin" className="text-gray-500 hover:text-gray-700">
                投稿管理
              </Link>
              <Link to="/admin/ai-insights" className="text-gray-500 hover:text-gray-700">
                AI インサイト
              </Link>
              <Link to="/admin/qa" className="font-medium text-brand-600">
                Q&A 管理
              </Link>
              <Link to="/portal" className="text-gray-500 hover:text-gray-700">
                ポータル
              </Link>
            </nav>
          </div>
          <span className="text-sm text-gray-500">{user.displayName}</span>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <h1 className="mb-6 text-2xl font-bold text-gray-900">Q&A 管理</h1>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Left: Thread list */}
          <div className="lg:col-span-1">
            {/* Status filter tabs */}
            <div className="mb-4 flex gap-1 rounded-lg bg-gray-100 p-1">
              {statusFilters.map((f) => (
                <Link
                  key={f.value}
                  to={`/admin/qa?status=${f.value}`}
                  className={`flex-1 rounded-md px-3 py-1.5 text-center text-xs font-medium transition ${
                    currentStatus === f.value
                      ? "bg-white text-gray-900 shadow-sm"
                      : "text-gray-500 hover:text-gray-700"
                  }`}
                >
                  {f.label}
                </Link>
              ))}
            </div>

            {/* Thread list */}
            <div className="space-y-2">
              {threads.length === 0 && (
                <p className="py-8 text-center text-sm text-gray-400">
                  スレッドがありません
                </p>
              )}
              {threads.map((t) => (
                <Link
                  key={t.id}
                  to={`/admin/qa?status=${currentStatus}&thread=${t.id}`}
                  className={`block rounded-xl border p-3 transition ${
                    activeThread?.id === t.id
                      ? "border-brand-300 bg-brand-50"
                      : "border-gray-200 bg-white hover:border-gray-300"
                  }`}
                >
                  <div className="mb-1 flex items-center justify-between">
                    <span className="text-xs font-medium text-gray-900 truncate max-w-[70%]">
                      {t.postTitle ?? "不明な記事"}
                    </span>
                    <StatusBadge status={t.status ?? "active"} />
                  </div>
                  <div className="flex items-center gap-2 text-[11px] text-gray-400">
                    <span>{t.messageCount} メッセージ</span>
                    <span>{t.updatedAt}</span>
                  </div>
                </Link>
              ))}
            </div>

            {/* Flagged messages section */}
            {flagged.length > 0 && (
              <div className="mt-6">
                <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-red-600">
                  フラグ付きメッセージ ({flagged.length})
                </h2>
                <div className="space-y-2">
                  {flagged.map((f) => (
                    <div
                      key={f.id}
                      className="rounded-lg border border-red-200 bg-red-50 p-3"
                    >
                      <p className="text-xs text-gray-700 line-clamp-2">
                        {f.content}
                      </p>
                      <div className="mt-1 flex items-center gap-2 text-[10px] text-gray-400">
                        <span>{f.createdAt}</span>
                        <Link
                          to={`/admin/qa?status=${currentStatus}&thread=${f.threadId}`}
                          className="text-brand-500 hover:underline"
                        >
                          スレッドを表示
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Right: Thread detail */}
          <div className="lg:col-span-2">
            {activeThread ? (
              <div className="rounded-xl border bg-white">
                {/* Thread header with actions */}
                <div className="flex items-center justify-between border-b px-4 py-3">
                  <h2 className="text-sm font-bold text-gray-900">
                    スレッド詳細
                  </h2>
                  <div className="flex gap-2">
                    <Form method="post">
                      <input type="hidden" name="intent" value="update-status" />
                      <input type="hidden" name="threadId" value={activeThread.id} />
                      <input type="hidden" name="status" value="resolved" />
                      <button
                        type="submit"
                        disabled={isBusy}
                        className="rounded-md bg-green-100 px-3 py-1 text-xs font-medium text-green-700 hover:bg-green-200 disabled:opacity-50"
                      >
                        解決済みにする
                      </button>
                    </Form>
                    <Form method="post">
                      <input type="hidden" name="intent" value="update-status" />
                      <input type="hidden" name="threadId" value={activeThread.id} />
                      <input type="hidden" name="status" value="flagged" />
                      <button
                        type="submit"
                        disabled={isBusy}
                        className="rounded-md bg-red-100 px-3 py-1 text-xs font-medium text-red-700 hover:bg-red-200 disabled:opacity-50"
                      >
                        フラグ
                      </button>
                    </Form>
                  </div>
                </div>

                {/* Messages */}
                <div
                  className="space-y-3 overflow-y-auto p-4"
                  style={{ maxHeight: "28rem" }}
                >
                  {activeThread.messages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`flex ${
                        msg.role === "user" ? "justify-end" : "justify-start"
                      }`}
                    >
                      <div
                        className={`max-w-[75%] rounded-xl px-3 py-2 text-sm ${
                          msg.role === "user"
                            ? msg.flagged
                              ? "border border-red-300 bg-red-50 text-red-800"
                              : "bg-gray-200 text-gray-800"
                            : msg.role === "ai"
                              ? "bg-brand-50 text-gray-800"
                              : "border border-green-200 bg-green-50 text-gray-800"
                        }`}
                      >
                        <div className="mb-0.5 text-[10px] font-medium uppercase text-gray-400">
                          {msg.role === "user"
                            ? "ユーザー"
                            : msg.role === "ai"
                              ? "AI"
                              : msg.role === "se"
                                ? "SE"
                                : msg.role === "admin"
                                  ? "Admin"
                                  : "System"}
                          {msg.flagged && (
                            <span className="ml-1 text-red-500">FLAGGED</span>
                          )}
                        </div>
                        <div className="whitespace-pre-wrap">{msg.content}</div>
                        <div className="mt-1 text-[10px] text-gray-400">
                          {msg.createdAt}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* SE/Admin reply */}
                <div className="border-t p-4">
                  <Form method="post" className="flex gap-2">
                    <input type="hidden" name="intent" value="reply" />
                    <input
                      type="hidden"
                      name="threadId"
                      value={activeThread.id}
                    />
                    <input
                      type="text"
                      name="content"
                      placeholder="SE/Admin として回答..."
                      className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                    />
                    <button
                      type="submit"
                      disabled={isBusy}
                      className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
                    >
                      回答
                    </button>
                  </Form>
                </div>
              </div>
            ) : (
              <div className="flex h-64 items-center justify-center rounded-xl border border-dashed border-gray-200 bg-gray-50/50">
                <p className="text-sm text-gray-400">
                  左のスレッドを選択してください
                </p>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    active: "bg-blue-100 text-blue-700",
    resolved: "bg-green-100 text-green-700",
    flagged: "bg-red-100 text-red-700",
  };
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
        styles[status] ?? "bg-gray-100 text-gray-600"
      }`}
    >
      {status}
    </span>
  );
}
