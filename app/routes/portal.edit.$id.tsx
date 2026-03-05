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
  Link,
} from "@remix-run/react";
import { redirect } from "@remix-run/cloudflare";
import { useRef } from "react";
import { requireUser } from "~/lib/auth.server";
import {
  getPostById,
  updatePost,
  deletePost,
  publishPost,
  getAllCategories,
} from "~/lib/posts.server";
import { ImageUploader } from "~/components/ImageUploader";
import { MarkdownGuide } from "~/components/MarkdownGuide";

export const meta: MetaFunction<typeof loader> = ({ data }) => [
  { title: `${data?.post?.title ?? "記事"} を編集 — Cloudflare Solution Blog` },
];

export async function loader({ params, request, context }: LoaderFunctionArgs) {
  const user = await requireUser(request);
  const db = context.cloudflare.env.DB;
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
  const user = await requireUser(request);
  const db = context.cloudflare.env.DB;
  const postId = params.id;
  if (!postId) throw new Response("Not Found", { status: 404 });

  const formData = await request.formData();
  const intent = formData.get("intent") as string;

  if (intent === "delete") {
    await deletePost(db, postId, user);
    return redirect("/portal/posts");
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
              <ImageUploader onInsert={handleImageInsert} />
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

          {/* Actions */}
          <div className="flex items-center justify-between border-t pt-6">
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
