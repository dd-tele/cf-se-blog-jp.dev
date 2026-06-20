import type {
  ActionFunctionArgs,
  LoaderFunctionArgs,
  MetaFunction,
} from "@remix-run/cloudflare";
import { redirect } from "@remix-run/cloudflare";
import { Form, Link, useActionData, useNavigation } from "@remix-run/react";
import { useState } from "react";
import { requireUser } from "~/lib/auth.server";
import { ensureUser } from "~/lib/posts.server";
import { createSlide, validateSlideHtml, userCanUploadSlides } from "~/lib/slides.server";
import { unpackSlideBundle, storeBundleAssets } from "~/lib/slides-bundle.server";
import { ulid } from "~/lib/ulid";

export const meta: MetaFunction = () => [
  { title: "スライドをアップロード — Cloudflare フィールドノート" },
];

const MAX_HTML_BYTES = 2 * 1024 * 1024; // 2MB
const MAX_ZIP_BYTES = 30 * 1024 * 1024; // 30MB compressed

export async function loader({ request, context }: LoaderFunctionArgs) {
  const env = context.cloudflare.env;
  const user = await requireUser(request, env);
  if (!(await userCanUploadSlides(env.DB, user))) {
    throw redirect("/portal/slides?denied=1");
  }
  return { user };
}

export async function action({ request, context }: ActionFunctionArgs) {
  const env = context.cloudflare.env;
  const user = await requireUser(request, env);
  if (!(await userCanUploadSlides(env.DB, user))) {
    return { error: "スライドをアップロードする権限がありません。管理者に許可を依頼してください。" };
  }
  await ensureUser(env.DB, user);

  const form = await request.formData();
  const title = (form.get("title") as string)?.trim();
  const description = (form.get("description") as string) || undefined;
  const eventName = (form.get("eventName") as string) || undefined;
  const presentedAt = (form.get("presentedAt") as string) || undefined;
  const tagsStr = (form.get("tags") as string) || "";
  const visibility = (form.get("visibility") as string) === "limited" ? "limited" : "public";
  const status = (form.get("status") as string) === "draft" ? "draft" : "published";
  const coverImageUrl = (form.get("coverImageUrl") as string) || undefined;

  if (!title) return { error: "タイトルは必須です。" };

  const tagsJson = tagsStr
    ? JSON.stringify(tagsStr.split(",").map((t) => t.trim()).filter(Boolean))
    : undefined;

  // Source: ZIP bundle (HTML + assets), single HTML file, or pasted HTML.
  const file = form.get("htmlFile") as File | null;
  const pasted = (form.get("htmlText") as string) || "";
  const isZip =
    file instanceof File &&
    file.size > 0 &&
    (/\.zip$/i.test(file.name) ||
      file.type === "application/zip" ||
      file.type === "application/x-zip-compressed");

  try {
    // ─── ZIP bundle ─────────────────────────────────────────
    if (isZip) {
      if (file!.size > MAX_ZIP_BYTES) {
        return { error: "ZIP ファイルが大きすぎます（最大 30MB）。" };
      }
      let bundle;
      try {
        bundle = unpackSlideBundle(await file!.arrayBuffer());
      } catch (e: any) {
        return { error: e?.message || "ZIP の展開に失敗しました。" };
      }

      const check = validateSlideHtml(bundle.entryHtml);
      if (!check.ok) return { error: check.error };

      const id = ulid();
      const assetPrefix = `slides/${id}`;
      await storeBundleAssets(env.R2_BUCKET, id, bundle.assets);

      const result = await createSlide(
        env.DB,
        {
          id,
          title,
          description,
          eventName,
          presentedAt,
          rawHtml: bundle.entryHtml,
          coverImageUrl,
          tagsJson,
          status,
          visibility,
          assetPrefix,
          skipAssetRewrite: true,
        },
        user
      );
      return redirect(`/slides/${result.slug}`);
    }

    // ─── Single HTML (file or pasted) ───────────────────────
    let rawHtml = "";
    if (file instanceof File && file.size > 0) {
      if (file.size > MAX_HTML_BYTES) {
        return { error: "HTML ファイルが大きすぎます（最大 2MB）。" };
      }
      rawHtml = await file.text();
    } else if (pasted.trim()) {
      rawHtml = pasted;
    }
    if (!rawHtml) {
      return { error: "ZIP / HTML ファイルを選択するか、HTML を貼り付けてください。" };
    }

    const check = validateSlideHtml(rawHtml);
    if (!check.ok) return { error: check.error };

    const result = await createSlide(
      env.DB,
      {
        title,
        description,
        eventName,
        presentedAt,
        rawHtml,
        coverImageUrl,
        tagsJson,
        status,
        visibility,
      },
      user
    );
    return redirect(`/slides/${result.slug}`);
  } catch (e: any) {
    return { error: e?.message || "スライドの保存に失敗しました。" };
  }
}

export default function NewSlide() {
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";
  const [fileName, setFileName] = useState<string>("");

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
        <h1 className="mb-2 text-2xl font-bold text-gray-900">スライドをアップロード</h1>
        <p className="mb-6 text-sm text-gray-500">
          HTML スライドをアップロードします。reveal.js に限らず任意の HTML スライドに対応しています。
          画像・CSS・JS などのアセットを含む場合は、<code className="rounded bg-gray-100 px-1">index.html</code> を含めた一式を
          <strong>ZIP</strong> にまとめてアップロードしてください（相対パスはそのまま解決されます）。
          単一の自己完結 HTML や貼り付けにも対応します。
        </p>

        {actionData && "error" in actionData && actionData.error && (
          <div className="mb-6 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
            {actionData.error}
          </div>
        )}

        <Form method="post" encType="multipart/form-data" className="space-y-6">
          <div>
            <label htmlFor="title" className="mb-1 block text-sm font-medium text-gray-700">
              タイトル *
            </label>
            <input
              type="text"
              id="title"
              name="title"
              required
              placeholder="例: Cloudflare Agents 入門"
              className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
          </div>

          <div>
            <label htmlFor="description" className="mb-1 block text-sm font-medium text-gray-700">
              説明
            </label>
            <textarea
              id="description"
              name="description"
              rows={3}
              placeholder="スライドの概要を入力..."
              className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
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
                placeholder="例: Interop 2026"
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
              placeholder="Agents, Workers AI, Edge"
              className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
          </div>

          <div>
            <label htmlFor="coverImageUrl" className="mb-1 block text-sm font-medium text-gray-700">
              カバー画像 URL（任意）
            </label>
            <input
              type="url"
              id="coverImageUrl"
              name="coverImageUrl"
              placeholder="https://.../cover.png"
              className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
          </div>

          {/* HTML source */}
          <div className="rounded-xl border border-gray-200 bg-white p-5">
            <h2 className="mb-3 text-sm font-semibold text-gray-900">スライド（ZIP または HTML） *</h2>
            <label
              htmlFor="htmlFile"
              className="flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 px-6 py-8 text-center hover:border-brand-400"
            >
              <svg className="mb-2 h-8 w-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 7.5 7.5 12M12 7.5V21" />
              </svg>
              <span className="text-sm font-medium text-gray-700">
                {fileName || ".zip または .html ファイルを選択"}
              </span>
              <span className="mt-1 text-xs text-gray-400">ZIP は最大 30MB / 単一 HTML は最大 2MB</span>
              <input
                type="file"
                id="htmlFile"
                name="htmlFile"
                accept=".zip,application/zip,.html,text/html"
                className="hidden"
                onChange={(e) => setFileName(e.target.files?.[0]?.name ?? "")}
              />
            </label>

            <div className="my-3 text-center text-xs text-gray-400">または HTML を貼り付け（単一ファイル）</div>
            <textarea
              name="htmlText"
              rows={6}
              placeholder="<!doctype html> ..."
              className="w-full rounded-lg border border-gray-300 px-3 py-2 font-mono text-xs focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
          </div>

          {/* Publish options */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="status" className="mb-1 block text-sm font-medium text-gray-700">
                公開状態
              </label>
              <select
                id="status"
                name="status"
                defaultValue="published"
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
                defaultValue="public"
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
              {isSubmitting ? "アップロード中..." : "アップロード"}
            </button>
          </div>
        </Form>
      </main>
    </div>
  );
}
