import type {
  ActionFunctionArgs,
  LoaderFunctionArgs,
  MetaFunction,
} from "@remix-run/cloudflare";
import { Form, useLoaderData, useActionData, useNavigation, Link } from "@remix-run/react";
import { redirect } from "@remix-run/cloudflare";
import { useRef, useState, useCallback } from "react";
import { requireUser } from "~/lib/auth.server";
import { createPost, getAllCategories, ensureUser } from "~/lib/posts.server";
import { ImageUploader } from "~/components/ImageUploader";
import { ContentToolbar } from "~/components/ContentToolbar";
import { MarkdownGuide } from "~/components/MarkdownGuide";
import { MarkdownImportModal } from "~/components/MarkdownImportModal";
import type { ImportedData } from "~/components/MarkdownImportModal";

export const meta: MetaFunction = () => [
  { title: "新しい記事を書く — Cloudflare Solution Blog" },
];

export async function loader({ request, context }: LoaderFunctionArgs) {
  const env = context.cloudflare.env;
  const user = await requireUser(request, env);
  const db = env.DB;
  const categories = await getAllCategories(db);
  return { user, categories };
}

export async function action({ request, context }: ActionFunctionArgs) {
  const env = context.cloudflare.env;
  const user = await requireUser(request, env);
  const db = env.DB;

  // Ensure user exists in D1
  await ensureUser(db, user);

  const formData = await request.formData();
  const title = formData.get("title") as string;
  const content = formData.get("content") as string;
  const categoryId = (formData.get("categoryId") as string) || undefined;
  const tagsStr = formData.get("tags") as string;
  const tagsJson = tagsStr
    ? JSON.stringify(tagsStr.split(",").map((t) => t.trim()).filter(Boolean))
    : undefined;

  if (!title || !content) {
    return { error: "タイトルと本文は必須です" };
  }

  try {
    const result = await createPost(
      db,
      { title, content, categoryId, tagsJson },
      user
    );

    return redirect(`/portal/edit/${result.id}?saved=draft`);
  } catch (e: any) {
    return { error: e.message || "記事の作成に失敗しました" };
  }
}

export default function NewPost() {
  const { user, categories } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";
  const contentRef = useRef<HTMLTextAreaElement>(null);

  const [title, setTitle] = useState("");
  const [tags, setTags] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [content, setContent] = useState("");
  const [importOpen, setImportOpen] = useState(false);

  const handleImport = useCallback(
    (data: ImportedData) => {
      if (data.title) setTitle(data.title);
      if (data.tags) setTags(data.tags);
      setContent(data.content);

      // Match category name to ID (case-insensitive partial match)
      if (data.category) {
        const lower = data.category.toLowerCase();
        const match = categories.find(
          (c) =>
            c.name.toLowerCase() === lower ||
            c.name.toLowerCase().includes(lower) ||
            lower.includes(c.name.toLowerCase())
        );
        if (match) setCategoryId(match.id);
      }
    },
    [categories]
  );

  function handleImageInsert(markdown: string) {
    const ta = contentRef.current;
    if (!ta) return;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const newValue = content.slice(0, start) + markdown + content.slice(end);
    setContent(newValue);
    // Restore cursor position after React re-render
    requestAnimationFrame(() => {
      ta.selectionStart = ta.selectionEnd = start + markdown.length;
      ta.focus();
    });
  }

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
            <Link to="/portal" className="text-sm text-gray-500 hover:text-gray-700">
              ← ダッシュボード
            </Link>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-500">{user.displayName}</span>
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                user.role === "admin"
                  ? "bg-red-100 text-red-700"
                  : user.role === "se"
                    ? "bg-blue-100 text-blue-700"
                    : "bg-green-100 text-green-700"
              }`}
            >
              {user.role}
            </span>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">
            新しい記事を書く
          </h1>
          <button
            type="button"
            onClick={() => setImportOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 transition-colors"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
            Markdown インポート
          </button>
        </div>

        {actionData && "error" in actionData && (
          <div className="mb-6 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
            {actionData.error}
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
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="記事のタイトルを入力..."
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
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
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
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="Workers, D1, セキュリティ"
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
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="記事の内容を入力...&#10;&#10;Markdown 形式で記述できます。"
              className="w-full rounded-lg border border-gray-300 px-4 py-3 font-mono text-sm leading-relaxed focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
            <div className="mt-2 flex items-start justify-between gap-4">
              <p className="text-xs text-gray-400">
                Markdown 形式で記述できます。画像は上の「画像を挿入」ボタンからアップロードできます。
              </p>
              <MarkdownGuide />
            </div>
          </div>

          {/* Submit */}
          <div className="flex items-center justify-between border-t pt-6">
            <Link
              to="/portal"
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              キャンセル
            </Link>
            <button
              type="submit"
              disabled={isSubmitting}
              className="rounded-lg bg-brand-500 px-8 py-3 text-sm font-semibold text-white shadow-sm hover:bg-brand-600 disabled:opacity-50 transition-colors"
            >
              {isSubmitting ? "保存中..." : "下書き保存"}
            </button>
          </div>
        </Form>
      </main>

      <MarkdownImportModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onImport={handleImport}
      />
    </div>
  );
}
