import type {
  ActionFunctionArgs,
  LoaderFunctionArgs,
  MetaFunction,
} from "@remix-run/cloudflare";
import {
  Form,
  useLoaderData,
  useActionData,
  useNavigation,
  useFetcher,
  Link,
} from "@remix-run/react";
import { redirect } from "@remix-run/cloudflare";
import { useRef, useState, useCallback, useEffect, useMemo } from "react";
import { marked, type Tokens } from "marked";

// Configure client-side marked with mermaid support (mirrors markdown.server.ts)
function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
const clientRenderer = new marked.Renderer();
const originalCode = clientRenderer.code.bind(clientRenderer);
clientRenderer.code = function (token: Tokens.Code): string {
  if (token.lang === "mermaid") {
    return `<pre class="mermaid">${escapeHtml(token.text)}</pre>`;
  }
  return originalCode(token);
};
import { requireUser } from "~/lib/auth.server";
import {
  getPostById,
  updatePost,
  deletePost,
  publishPost,
  getAllCategories,
} from "~/lib/posts.server";
import { refineWithEssence } from "~/lib/ai.server";
import { ImageUploader } from "~/components/ImageUploader";
import { ContentToolbar } from "~/components/ContentToolbar";
import { MarkdownGuide } from "~/components/MarkdownGuide";

export const meta: MetaFunction<typeof loader> = ({ data }) => [
  { title: `${data?.post?.title ?? "記事"} を編集 — Cloudflare Solution Blog` },
];

export async function loader({ params, request, context }: LoaderFunctionArgs) {
  const env = context.cloudflare.env;
  const user = await requireUser(request, env);
  const db = env.DB;
  const postId = params.id;
  if (!postId) throw new Response("Not Found", { status: 404 });

  const post = await getPostById(db, postId);
  if (!post) throw new Response("Not Found", { status: 404 });
  if (post.author_id !== user.id && user.role !== "admin") {
    throw new Response("Forbidden", { status: 403 });
  }

  const categories = await getAllCategories(db);
  return { post, categories, user };
}

export async function action({ params, request, context }: ActionFunctionArgs) {
  const env = context.cloudflare.env;
  const user = await requireUser(request, env);
  const db = env.DB;
  const postId = params.id;
  if (!postId) throw new Response("Not Found", { status: 404 });

  const formData = await request.formData();
  const intent = formData.get("intent") as string;

  if (intent === "delete") {
    await deletePost(db, postId, user);
    return redirect("/portal/posts");
  }

  if (intent === "ai-refine") {
    const content = formData.get("content") as string;
    const essence = formData.get("essence") as string;
    const title = formData.get("title") as string;
    if (!content || !essence) {
      return { error: "本文と追加エッセンスは必須です" };
    }
    try {
      const ai = env.AI;
      const refined = await refineWithEssence(ai, content, essence, title);
      return { aiRefined: refined };
    } catch (e: any) {
      return { error: `AI アシスト修正に失敗しました: ${e.message || "Unknown error"}` };
    }
  }

  const title = formData.get("title") as string;
  const content = formData.get("content") as string;
  const categoryId = (formData.get("categoryId") as string) || undefined;
  const tagsStr = formData.get("tags") as string;
  const tagsJson = tagsStr
    ? JSON.stringify(
        tagsStr
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean)
      )
    : undefined;
  const status = (formData.get("status") as string) || undefined;

  if (!title || !content) {
    return { error: "タイトルと本文は必須です" };
  }

  try {
    await updatePost(
      db,
      postId,
      {
        title,
        content,
        categoryId,
        tagsJson,
      },
      user
    );

    if (intent === "publish") {
      const published = await publishPost(db, postId, user);
      return redirect(`/posts/${published.slug}`);
    }
    return { success: true, message: "下書きを保存しました" };
  } catch (e: any) {
    return { error: e.message || "更新に失敗しました" };
  }
}

export default function EditPost() {
  const { post, categories, user } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  const tags: string[] = post.tags_json ? JSON.parse(post.tags_json) : [];
  const contentRef = useRef<HTMLTextAreaElement>(null);
  const [aiPanelOpen, setAiPanelOpen] = useState(false);
  const [essence, setEssence] = useState("");
  const [aiResult, setAiResult] = useState<string | null>(null);
  const [aiPreviewMode, setAiPreviewMode] = useState<"rendered" | "raw">("rendered");

  const aiPreviewRef = useRef<HTMLDivElement>(null);

  // Render AI result as HTML for preview
  const aiResultHtml = useMemo(() => {
    if (!aiResult) return "";
    return marked.parse(aiResult, { async: false, gfm: true, breaks: true, renderer: clientRenderer }) as string;
  }, [aiResult]);

  // Initialize mermaid.js when AI preview HTML is rendered
  useEffect(() => {
    if (!aiResultHtml || aiPreviewMode !== "rendered") return;
    const container = aiPreviewRef.current;
    if (!container) return;
    const nodes = container.querySelectorAll("pre.mermaid");
    if (nodes.length === 0) return;

    let cancelled = false;
    async function initMermaid() {
      if (cancelled) return;
      const m = (window as any).mermaid;
      if (!m) return;
      m.initialize({ startOnLoad: false, theme: "neutral", securityLevel: "loose", fontFamily: "ui-sans-serif, system-ui, sans-serif" });
      // Validate each diagram before rendering; show source on error
      for (const node of Array.from(nodes) as HTMLElement[]) {
        try {
          await m.parse(node.textContent || "");
        } catch {
          const code = document.createElement("div");
          code.className = "rounded bg-red-50 border border-red-200 p-3 text-xs";
          code.innerHTML = `<p class="text-red-600 font-semibold mb-1">⚠ Mermaid 構文エラー — Markdown ソースタブで確認・修正してください</p><pre class="whitespace-pre-wrap text-gray-600">${node.textContent}</pre>`;
          node.replaceWith(code);
        }
      }
      const validNodes = container!.querySelectorAll("pre.mermaid");
      if (validNodes.length > 0) m.run({ nodes: validNodes });
    }
    if ((window as any).mermaid) {
      initMermaid();
    } else {
      const script = document.createElement("script");
      script.src = "https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.min.js";
      script.onload = initMermaid;
      document.head.appendChild(script);
    }
    return () => { cancelled = true; };
  }, [aiResultHtml, aiPreviewMode]);
  const aiFetcher = useFetcher<{ aiRefined?: string; error?: string }>();
  const aiLoading = aiFetcher.state !== "idle";

  // Watch fetcher data for AI refine results
  useEffect(() => {
    if (aiFetcher.data) {
      if (aiFetcher.data.aiRefined) {
        setAiResult(aiFetcher.data.aiRefined);
      } else if (aiFetcher.data.error) {
        alert(aiFetcher.data.error);
      }
    }
  }, [aiFetcher.data]);

  // Apply AI-refined content to the textarea
  const applyAiResult = useCallback(() => {
    const ta = contentRef.current;
    if (!ta || !aiResult) return;
    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value')?.set;
    nativeInputValueSetter?.call(ta, aiResult);
    ta.dispatchEvent(new Event('input', { bubbles: true }));
    setAiResult(null);
    setEssence("");
    setAiPanelOpen(false);
  }, [aiResult]);

  // Submit AI refine request via useFetcher
  const handleAiRefine = useCallback(() => {
    const ta = contentRef.current;
    if (!ta || !essence.trim()) return;
    setAiResult(null);
    const body = new FormData();
    body.set("intent", "ai-refine");
    body.set("content", ta.value);
    body.set("essence", essence);
    const titleEl = document.getElementById("title") as HTMLInputElement | null;
    if (titleEl) body.set("title", titleEl.value);
    aiFetcher.submit(body, { method: "POST" });
  }, [essence, aiFetcher]);

  function handleImageInsert(markdown: string) {
    const ta = contentRef.current;
    if (!ta) return;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const value = ta.value;
    ta.value = value.slice(0, start) + markdown + value.slice(end);
    ta.selectionStart = ta.selectionEnd = start + markdown.length;
    ta.focus();
    // Trigger React's change detection
    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value')?.set;
    nativeInputValueSetter?.call(ta, ta.value);
    ta.dispatchEvent(new Event('input', { bubbles: true }));
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b bg-white">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-4">
            <Link to="/" className="text-lg font-bold text-gray-900 hover:text-brand-600 transition-colors">
              Cloudflare Solution Blog
            </Link>
            <span className="text-sm text-gray-400">|</span>
            <Link to="/portal/posts" className="text-sm text-gray-500 hover:text-gray-700">
              ← マイ記事
            </Link>
          </div>
          <div className="flex items-center gap-3">
            <span
              className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                post.status === "published"
                  ? "bg-green-100 text-green-700"
                  : "bg-gray-100 text-gray-700"
              }`}
            >
              {post.status === "published" ? "公開中" : "下書き"}
            </span>
            <a
              href={`/posts/${post.slug}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 transition hover:bg-gray-50"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>
              プレビュー
            </a>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
        {actionData && "error" in actionData && (
          <div className="mb-6 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
            {actionData.error}
          </div>
        )}
        {actionData && "success" in actionData && (
          <div className="mb-6 rounded-lg bg-green-50 px-4 py-3 text-sm text-green-700">
            {actionData.message}
          </div>
        )}

        <Form method="post" className="space-y-6">
          {/* Title */}
          <div>
            <label
              htmlFor="title"
              className="mb-1 block text-sm font-medium text-gray-700"
            >
              タイトル *
            </label>
            <input
              type="text"
              id="title"
              name="title"
              required
              defaultValue={post.title}
              className="w-full rounded-lg border border-gray-300 px-4 py-3 text-lg focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
          </div>

          {/* Category */}
          <div>
            <label
              htmlFor="categoryId"
              className="mb-1 block text-sm font-medium text-gray-700"
            >
              カテゴリ
            </label>
            <select
              id="categoryId"
              name="categoryId"
              defaultValue={post.category_id ?? ""}
              className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            >
              <option value="">選択してください</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.icon} {cat.name}
                </option>
              ))}
            </select>
          </div>

          {/* Tags */}
          <div>
            <label
              htmlFor="tags"
              className="mb-1 block text-sm font-medium text-gray-700"
            >
              タグ（カンマ区切り）
            </label>
            <input
              type="text"
              id="tags"
              name="tags"
              defaultValue={tags.join(", ")}
              className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
          </div>

          {/* Content */}
          <div>
            <div className="mb-1 flex items-center justify-between">
              <label
                htmlFor="content"
                className="block text-sm font-medium text-gray-700"
              >
                本文 *
              </label>
              <div className="flex items-center gap-2">
                <ContentToolbar onInsert={handleImageInsert} />
                <ImageUploader onInsert={handleImageInsert} />
              </div>
            </div>
            <textarea
              ref={contentRef}
              id="content"
              name="content"
              required
              rows={20}
              defaultValue={post.content}
              className="w-full rounded-lg border border-gray-300 px-4 py-3 font-mono text-sm leading-relaxed focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
            <div className="mt-2 flex items-start justify-between gap-4">
              <p className="text-xs text-gray-400">
                Markdown 形式で記述できます。画像は上の「画像を挿入」ボタンからアップロードできます。
              </p>
              <MarkdownGuide />
            </div>
          </div>

          {/* AI Assist Refinement Panel */}
          <div className="rounded-xl border border-purple-200 bg-purple-50/50">
            <button
              type="button"
              onClick={() => setAiPanelOpen(!aiPanelOpen)}
              className="flex w-full items-center justify-between px-5 py-3 text-left"
            >
              <div className="flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-purple-600"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/><path d="M5 3v4"/><path d="M19 17v4"/><path d="M3 5h4"/><path d="M17 19h4"/></svg>
                <span className="text-sm font-semibold text-purple-800">AI アシスト修正</span>
                <span className="text-xs text-purple-500">— 追加エッセンスを取り込んで本文を自動修正</span>
              </div>
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`text-purple-400 transition-transform ${aiPanelOpen ? "rotate-180" : ""}`}><path d="m6 9 6 6 6-6"/></svg>
            </button>

            {aiPanelOpen && (
              <div className="border-t border-purple-200 px-5 py-4 space-y-4">
                <div>
                  <label className="mb-1 block text-sm font-medium text-purple-800">
                    追加エッセンス
                  </label>
                  <p className="mb-2 text-xs text-purple-500">
                    プレビューで気づいたこと、思い出した補足情報、修正したい箇所を自由に記述してください。AI が本文に自然に組み込みます。
                  </p>
                  <textarea
                    value={essence}
                    onChange={(e) => setEssence(e.target.value)}
                    rows={4}
                    placeholder="例: 「Workers の制限事項について CPU 時間 50ms の上限を追記して」「冒頭にユースケースの概要を追加して」「Wrangler のバージョンは 3.x に更新して」"
                    className="w-full rounded-lg border border-purple-300 bg-white px-4 py-3 text-sm leading-relaxed placeholder:text-purple-300 focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
                  />
                </div>

                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={handleAiRefine}
                    disabled={aiLoading || !essence.trim()}
                    className="flex items-center gap-2 rounded-lg bg-purple-600 px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-purple-700 disabled:opacity-50"
                  >
                    {aiLoading ? (
                      <>
                        <svg className="h-4 w-4 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
                        AI が修正中…
                      </>
                    ) : (
                      <>
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/></svg>
                        AI で修正を生成
                      </>
                    )}
                  </button>
                  {aiResult && (
                    <span className="text-xs text-green-600 font-medium">修正案が生成されました — 下のプレビューを確認してください</span>
                  )}
                </div>

                {aiResult && (
                  <div className="space-y-3">
                    <div>
                      <div className="mb-2 flex items-center justify-between">
                        <div className="flex items-center gap-1 rounded-lg bg-purple-100 p-0.5">
                          <button
                            type="button"
                            onClick={() => setAiPreviewMode("rendered")}
                            className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                              aiPreviewMode === "rendered"
                                ? "bg-white text-purple-800 shadow-sm"
                                : "text-purple-500 hover:text-purple-700"
                            }`}
                          >
                            HTML プレビュー
                          </button>
                          <button
                            type="button"
                            onClick={() => setAiPreviewMode("raw")}
                            className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                              aiPreviewMode === "raw"
                                ? "bg-white text-purple-800 shadow-sm"
                                : "text-purple-500 hover:text-purple-700"
                            }`}
                          >
                            Markdown ソース
                          </button>
                        </div>
                        <span className="text-xs text-gray-400">{aiResult.length.toLocaleString()} 文字</span>
                      </div>
                      {aiPreviewMode === "rendered" ? (
                        <div
                          ref={aiPreviewRef}
                          className="prose prose-sm max-w-none max-h-[32rem] overflow-y-auto rounded-lg border border-purple-200 bg-white p-6"
                          dangerouslySetInnerHTML={{ __html: aiResultHtml }}
                        />
                      ) : (
                        <div className="max-h-[32rem] overflow-y-auto rounded-lg border border-purple-200 bg-white p-4 font-mono text-sm leading-relaxed text-gray-800 whitespace-pre-wrap">
                          {aiResult}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={applyAiResult}
                        className="flex items-center gap-1.5 rounded-lg bg-green-600 px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-green-700"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
                        本文に適用
                      </button>
                      <button
                        type="button"
                        onClick={() => setAiResult(null)}
                        className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50"
                      >
                        破棄
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between border-t pt-6">
            <div className="flex items-center gap-4">
              <Link
                to="/portal/posts"
                onClick={(e) => {
                  if (!confirm("編集内容を破棄してマイ記事に戻りますか？")) e.preventDefault();
                }}
                className="text-sm text-gray-500 hover:text-gray-700"
              >
                キャンセル
              </Link>
              <Form method="post">
                <input type="hidden" name="intent" value="delete" />
                <button
                  type="submit"
                  onClick={(e) => {
                    if (!confirm("この記事を削除しますか？")) e.preventDefault();
                  }}
                  className="text-sm text-red-500 hover:text-red-700"
                >
                  削除
                </button>
              </Form>
            </div>

            <div className="flex gap-3">
              <a
                href={`/posts/${post.slug}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-5 py-2.5 text-sm font-medium text-blue-700 transition hover:bg-blue-100"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>
                プレビュー
              </a>
              <button
                type="submit"
                name="intent"
                value="save"
                disabled={isSubmitting}
                className="rounded-lg border border-gray-300 px-6 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition-colors"
              >
                下書き保存
              </button>
              {post.status !== "published" && (
                <button
                  type="submit"
                  name="intent"
                  value="publish"
                  disabled={isSubmitting}
                  onClick={(e) => {
                    if (!confirm("この記事を公開しますか？")) e.preventDefault();
                  }}
                  className="rounded-lg bg-brand-500 px-6 py-2.5 text-sm font-semibold text-white hover:bg-brand-600 disabled:opacity-50 transition-colors"
                >
                  公開する
                </button>
              )}
              {post.status === "published" && (
                <button
                  type="submit"
                  name="intent"
                  value="save"
                  disabled={isSubmitting}
                  className="rounded-lg bg-brand-500 px-6 py-2.5 text-sm font-semibold text-white hover:bg-brand-600 disabled:opacity-50 transition-colors"
                >
                  更新
                </button>
              )}
            </div>
          </div>
        </Form>
      </main>
    </div>
  );
}
