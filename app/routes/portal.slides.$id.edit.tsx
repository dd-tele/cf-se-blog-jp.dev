import type {
  ActionFunctionArgs,
  LoaderFunctionArgs,
  MetaFunction,
} from "@remix-run/cloudflare";
import { redirect } from "@remix-run/cloudflare";
import { Form, Link, useActionData, useLoaderData, useNavigation } from "@remix-run/react";
import { requireUser } from "~/lib/auth.server";
import { getAllUsers } from "~/lib/access-requests.server";
import {
  getSlideById,
  updateSlide,
  canManageSlide,
  isSlugTakenByOther,
} from "~/lib/slides.server";
import { slugify } from "~/lib/utils";

export const meta: MetaFunction = () => [
  { title: "スライド編集 — Cloudflare フィールドノート" },
];

export async function loader({ request, context, params }: LoaderFunctionArgs) {
  const env = context.cloudflare.env;
  const user = await requireUser(request, env);
  const slide = await getSlideById(env.DB, params.id!);
  if (!slide) throw new Response("Not Found", { status: 404 });
  if (!canManageSlide(user, slide)) {
    throw new Response("このスライドを編集する権限がありません", { status: 403 });
  }

  const isAdmin = user.role === "admin";
  const authors = isAdmin
    ? (await getAllUsers(env.DB)).map((u) => ({
        id: u.id,
        name: u.nickname || u.display_name,
        role: u.role,
      }))
    : [];

  return { user, slide, isAdmin, authors };
}

export async function action({ request, context, params }: ActionFunctionArgs) {
  const env = context.cloudflare.env;
  const user = await requireUser(request, env);
  const id = params.id!;
  const slide = await getSlideById(env.DB, id);
  if (!slide) throw new Response("Not Found", { status: 404 });
  if (!canManageSlide(user, slide)) {
    throw new Response("権限がありません", { status: 403 });
  }

  const form = await request.formData();
  const title = (form.get("title") as string)?.trim();
  if (!title) return { error: "タイトルは必須です。" };

  let slug = slugify((form.get("slug") as string) || "");
  if (!slug) slug = slide.slug;
  if (slug !== slide.slug && (await isSlugTakenByOther(env.DB, slug, id))) {
    return { error: `スラッグ「${slug}」は既に使用されています。` };
  }

  const tagsStr = (form.get("tags") as string) || "";
  const tagsJson = tagsStr
    ? JSON.stringify(tagsStr.split(",").map((t) => t.trim()).filter(Boolean))
    : null;

  // Author can only be changed by admins.
  let authorId: string | undefined;
  if (user.role === "admin") {
    const selected = (form.get("authorId") as string) || "";
    if (selected) authorId = selected;
  }

  try {
    await updateSlide(env.DB, id, {
      title,
      slug,
      description: (form.get("description") as string) || null,
      eventName: (form.get("eventName") as string) || null,
      presentedAt: (form.get("presentedAt") as string) || null,
      coverImageUrl: (form.get("coverImageUrl") as string) || null,
      tagsJson,
      status: (form.get("status") as string) === "draft" ? "draft" : "published",
      visibility:
        (form.get("visibility") as string) === "limited" ? "limited" : "public",
      authorId,
    });
  } catch (e: any) {
    return { error: e?.message || "更新に失敗しました。" };
  }

  return redirect("/portal/slides");
}

export default function EditSlide() {
  const { slide, isAdmin, authors } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  const tags: string = (() => {
    try {
      return slide.tagsJson ? JSON.parse(slide.tagsJson).join(", ") : "";
    } catch {
      return "";
    }
  })();

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b bg-white">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-4">
            <Link to="/" className="text-lg font-bold text-gray-900 hover:text-brand-600">
              Cloudflare Field Notes
            </Link>
            <span className="text-sm text-gray-400">|</span>
            <Link to="/portal/slides" className="text-sm text-gray-500 hover:text-gray-700">
              ← スライド管理
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">スライド編集</h1>
            <p className="mt-1 text-sm text-gray-500">
              {slide.slideCount} スライド · {slide.viewCount} 回表示
            </p>
          </div>
          <a
            href={`/slides/${slide.slug}/view`}
            target="_blank"
            rel="noreferrer"
            className="whitespace-nowrap rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            プレビュー
          </a>
        </div>

        {actionData && "error" in actionData && actionData.error && (
          <div className="mb-6 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
            {actionData.error}
          </div>
        )}

        <Form method="post" className="space-y-6">
          <div>
            <label htmlFor="title" className="mb-1 block text-sm font-medium text-gray-700">
              タイトル *
            </label>
            <input
              type="text"
              id="title"
              name="title"
              required
              defaultValue={slide.title}
              className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
          </div>

          <div>
            <label htmlFor="slug" className="mb-1 block text-sm font-medium text-gray-700">
              スラッグ（URL）
            </label>
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-400">/slides/</span>
              <input
                type="text"
                id="slug"
                name="slug"
                defaultValue={slide.slug}
                className="flex-1 rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              />
            </div>
            <p className="mt-1 text-xs text-gray-400">
              変更すると公開 URL が変わります。既存リンクは無効になります。
            </p>
          </div>

          <div>
            <label htmlFor="description" className="mb-1 block text-sm font-medium text-gray-700">
              説明
            </label>
            <textarea
              id="description"
              name="description"
              rows={3}
              defaultValue={slide.description ?? ""}
              className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
          </div>

          {/* Author (admin only) */}
          <div>
            <label htmlFor="authorId" className="mb-1 block text-sm font-medium text-gray-700">
              制作者
            </label>
            {isAdmin ? (
              <select
                id="authorId"
                name="authorId"
                defaultValue={slide.authorId}
                className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              >
                {authors.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}（{a.role}）
                  </option>
                ))}
              </select>
            ) : (
              <input
                type="text"
                disabled
                value={slide.authorNameSnapshot ?? "—"}
                className="w-full rounded-lg border border-gray-200 bg-gray-100 px-4 py-2.5 text-sm text-gray-500"
              />
            )}
            {!isAdmin && (
              <p className="mt-1 text-xs text-gray-400">
                制作者の変更は管理者のみ可能です。
              </p>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="eventName" className="mb-1 block text-sm font-medium text-gray-700">
                イベント名
              </label>
              <input
                type="text"
                id="eventName"
                name="eventName"
                defaultValue={slide.eventName ?? ""}
                className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              />
            </div>
            <div>
              <label htmlFor="presentedAt" className="mb-1 block text-sm font-medium text-gray-700">
                登壇日
              </label>
              <input
                type="date"
                id="presentedAt"
                name="presentedAt"
                defaultValue={slide.presentedAt ?? ""}
                className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              />
            </div>
          </div>

          <div>
            <label htmlFor="tags" className="mb-1 block text-sm font-medium text-gray-700">
              タグ（カンマ区切り）
            </label>
            <input
              type="text"
              id="tags"
              name="tags"
              defaultValue={tags}
              className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
          </div>

          <div>
            <label htmlFor="coverImageUrl" className="mb-1 block text-sm font-medium text-gray-700">
              カバー画像 URL
            </label>
            <input
              type="url"
              id="coverImageUrl"
              name="coverImageUrl"
              defaultValue={slide.coverImageUrl ?? ""}
              className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="status" className="mb-1 block text-sm font-medium text-gray-700">
                公開状態
              </label>
              <select
                id="status"
                name="status"
                defaultValue={slide.status}
                className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              >
                <option value="published">公開</option>
                <option value="draft">下書き</option>
              </select>
            </div>
            <div>
              <label htmlFor="visibility" className="mb-1 block text-sm font-medium text-gray-700">
                公開範囲
              </label>
              <select
                id="visibility"
                name="visibility"
                defaultValue={slide.visibility}
                className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              >
                <option value="public">全体に公開</option>
                <option value="limited">限定（ログインユーザーのみ）</option>
              </select>
            </div>
          </div>

          <div className="flex items-center justify-between border-t pt-6">
            <Link to="/portal/slides" className="text-sm text-gray-500 hover:text-gray-700">
              キャンセル
            </Link>
            <button
              type="submit"
              disabled={isSubmitting}
              className="rounded-lg bg-brand-500 px-8 py-3 text-sm font-semibold text-white shadow-sm hover:bg-brand-600 disabled:opacity-50"
            >
              {isSubmitting ? "保存中..." : "変更を保存"}
            </button>
          </div>
        </Form>
      </main>
    </div>
  );
}
