import type {
  ActionFunctionArgs,
  LoaderFunctionArgs,
  MetaFunction,
} from "@remix-run/cloudflare";
import { redirect } from "@remix-run/cloudflare";
import { Form, Link, useActionData, useLoaderData, useNavigation } from "@remix-run/react";
import { useState } from "react";
import { requireUser } from "~/lib/auth.server";
import { createPost, ensureUser, getAllCategories } from "~/lib/posts.server";
import { ulid } from "~/lib/ulid";
import { CASE_KINDS, caseKind } from "~/lib/case-kind";
import {
  deleteGuideAssets,
  isZipFile,
  newGuidePrefix,
  parseGuideZip,
  storeGuideAssets,
  userCanUploadGuides,
} from "~/lib/case-guides.server";

const GUIDE_CATEGORY_DEFAULT = "cat-zt";

export const meta: MetaFunction = () => [
  { title: "事例をアップロード — Cloudflare フィールドノート" },
];

export async function loader({ request, context }: LoaderFunctionArgs) {
  const env = context.cloudflare.env;
  const user = await requireUser(request, env);
  if (!(await userCanUploadGuides(env.DB, user))) {
    throw redirect("/portal?denied=case-guide");
  }
  const categories = await getAllCategories(env.DB);
  return { categories };
}

export async function action({ request, context }: ActionFunctionArgs) {
  const env = context.cloudflare.env;
  const user = await requireUser(request, env);
  if (!(await userCanUploadGuides(env.DB, user))) {
    return { error: "事例をアップロードする権限がありません。管理者に許可を依頼してください。" };
  }
  await ensureUser(env.DB, user);

  const form = await request.formData();
  const file = form.get("zipFile");
  if (!(file instanceof File) || !isZipFile(file)) {
    return { error: "index.html と assets/ をまとめた ZIP ファイルを選択してください。" };
  }

  let parsed;
  try {
    parsed = await parseGuideZip(file);
  } catch (e: any) {
    return { error: e?.message || "ZIP の展開に失敗しました。" };
  }

  const title = ((form.get("title") as string) || "").trim() || parsed.title;
  if (!title) return { error: "タイトルを入力してください（HTML の <title> からも取得できませんでした）。" };

  const tagsStr = (form.get("tags") as string) || "";
  const tags = tagsStr.split(",").map((t) => t.trim()).filter(Boolean);
  const categoryId = (form.get("categoryId") as string) || GUIDE_CATEGORY_DEFAULT;
  const visibility = (form.get("visibility") as string) === "public" ? "public" : "limited";

  const id = ulid();
  const assetPrefix = newGuidePrefix(id);
  try {
    await storeGuideAssets(env.R2_BUCKET, id, parsed.bundle, assetPrefix);
    await createPost(
      env.DB,
      {
        id,
        title,
        content: parsed.bundle.entryHtml,
        categoryId,
        tagsJson: JSON.stringify(tags.length ? tags : [CASE_KINDS[caseKind(title)].label]),
        visibility,
        contentType: "case_guide",
        assetPrefix,
      },
      user
    );
  } catch (e: any) {
    // Do not leave orphaned screenshots behind when the row could not be created.
    await deleteGuideAssets(env.R2_BUCKET, assetPrefix).catch(() => {});
    return { error: e?.message || "事例の保存に失敗しました。" };
  }

  return redirect(`/portal/edit/${id}?uploaded=1`);
}

const inputClass =
  "w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500";

export default function NewCaseGuide() {
  const { categories } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";
  const [fileName, setFileName] = useState("");

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b bg-white">
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4 sm:px-6 lg:px-8">
          <Link to="/" className="text-lg font-bold text-gray-900 hover:text-brand-600">
            Cloudflare Field Notes
          </Link>
          <span className="text-sm text-gray-400">|</span>
          <Link to="/portal/posts" className="text-sm text-gray-500 hover:text-gray-700">
            ← マイ記事
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
        <h1 className="mb-2 text-2xl font-bold text-gray-900">事例をアップロード</h1>
        <p className="mb-6 text-sm leading-relaxed text-gray-500">
          手元の OpenCode で作成した設計ガイド・導入アーキテクチャ（<code className="rounded bg-gray-100 px-1">index.html</code> と
          <code className="rounded bg-gray-100 px-1">assets/</code> のスクリーンショット・接続図）を ZIP にまとめてアップロードします。
          種別はタイトル先頭の【設計ガイド】【導入アーキテクチャ】で判定され、一覧にバッジで表示されます。
          アップロード後は下書きとして保存され、記事と同じ編集画面から確認・公開できます。
          作成手順はリポジトリの <code className="rounded bg-gray-100 px-1">case-guides/AGENTS.md</code> を参照してください（OpenCode は <code className="rounded bg-gray-100 px-1">case-guides/</code> で起動します）。
        </p>

        {actionData?.error && (
          <div className="mb-6 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{actionData.error}</div>
        )}

        <Form method="post" encType="multipart/form-data" className="space-y-6">
          <div className="rounded-xl border border-gray-200 bg-white p-5">
            <h2 className="mb-3 text-sm font-semibold text-gray-900">事例 ZIP *</h2>
            <label
              htmlFor="zipFile"
              className="flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 px-6 py-8 text-center hover:border-brand-400"
            >
              <span className="text-sm font-medium text-gray-700">{fileName || ".zip ファイルを選択"}</span>
              <span className="mt-1 text-xs text-gray-400">
                最大 30MB / index.html は最大 1.5MB（画像は assets/ に分けてください）
              </span>
              <input
                type="file"
                id="zipFile"
                name="zipFile"
                required
                accept=".zip,application/zip"
                className="hidden"
                onChange={(e) => setFileName(e.target.files?.[0]?.name ?? "")}
              />
            </label>
          </div>

          <div>
            <label htmlFor="title" className="mb-1 block text-sm font-medium text-gray-700">
              タイトル
            </label>
            <input
              type="text"
              id="title"
              name="title"
              placeholder="空欄の場合は HTML の <title> を使用します"
              className={inputClass}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="categoryId" className="mb-1 block text-sm font-medium text-gray-700">
                カテゴリ
              </label>
              <select id="categoryId" name="categoryId" defaultValue={GUIDE_CATEGORY_DEFAULT} className={inputClass}>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="visibility" className="mb-1 block text-sm font-medium text-gray-700">
                公開範囲
              </label>
              <select id="visibility" name="visibility" defaultValue="limited" className={inputClass}>
                <option value="limited">限定（ログインユーザーのみ）</option>
                <option value="public">全体に公開</option>
              </select>
            </div>
          </div>

          <div>
            <label htmlFor="tags" className="mb-1 block text-sm font-medium text-gray-700">
              タグ（カンマ区切り）
            </label>
            <input type="text" id="tags" name="tags" placeholder="Zero Trust, Gateway, WARP" className={inputClass} />
          </div>

          <div className="flex items-center justify-between border-t pt-6">
            <Link to="/portal/posts" className="text-sm text-gray-500 hover:text-gray-700">
              キャンセル
            </Link>
            <button
              type="submit"
              disabled={isSubmitting}
              className="rounded-lg bg-brand-500 px-8 py-3 text-sm font-semibold text-white shadow-sm hover:bg-brand-600 disabled:opacity-50"
            >
              {isSubmitting ? "アップロード中..." : "下書きとしてアップロード"}
            </button>
          </div>
        </Form>
      </main>
    </div>
  );
}
