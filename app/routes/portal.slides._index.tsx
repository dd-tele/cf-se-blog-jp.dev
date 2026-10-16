import type {
  ActionFunctionArgs,
  LoaderFunctionArgs,
  MetaFunction,
} from "@remix-run/cloudflare";
import { useLoaderData, Link, Form, useSearchParams, useFetcher } from "@remix-run/react";
import { requireUser } from "~/lib/auth.server";
import {
  getManagedSlides,
  deleteSlide,
  getSlideById,
  canManageSlide,
  userCanUploadSlides,
  updateSlide,
} from "~/lib/slides.server";
import { deleteBundleAssets } from "~/lib/slides-bundle.server";
import { SLIDE_CATEGORY_LABEL, parseSlideCategory } from "~/lib/slide-categories";

export const meta: MetaFunction = () => [
  { title: "スライド管理 — Cloudflare フィールドノート" },
];

export async function loader({ request, context }: LoaderFunctionArgs) {
  const env = context.cloudflare.env;
  const user = await requireUser(request, env);
  const [slides, canUpload] = await Promise.all([
    getManagedSlides(env.DB, user),
    userCanUploadSlides(env.DB, user),
  ]);
  return { user, slides, canUpload, isAdmin: user.role === "admin" };
}

export async function action({ request, context }: ActionFunctionArgs) {
  const env = context.cloudflare.env;
  const user = await requireUser(request, env);
  const form = await request.formData();
  const intent = form.get("intent");
  if (intent === "presenter") {
    const id = form.get("id") as string;
    const slide = id ? await getSlideById(env.DB, id) : null;
    if (!slide || !canManageSlide(user, slide)) {
      throw new Response("権限がありません", { status: 403 });
    }
    await updateSlide(env.DB, id, { presenterEnabled: form.get("enabled") === "1" });
    return { ok: true };
  }
  if (intent === "delete") {
    const id = form.get("id") as string;
    if (id) {
      const slide = await getSlideById(env.DB, id);
      if (slide && canManageSlide(user, slide)) {
        if (slide.assetPrefix) {
          await deleteBundleAssets(env.R2_BUCKET, slide.assetPrefix);
        }
        await deleteSlide(env.DB, id, user);
      }
    }
  }
  return null;
}

/** ON/OFF switch for presentation mode; optimistic while saving. */
function PresenterToggle({ id, enabled }: { id: string; enabled: boolean }) {
  const fetcher = useFetcher();
  const pending = fetcher.formData?.get("enabled");
  const on = pending != null ? pending === "1" : enabled;
  return (
    <fetcher.Form method="post">
      <input type="hidden" name="intent" value="presenter" />
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="enabled" value={on ? "0" : "1"} />
      <button
        type="submit"
        role="switch"
        aria-checked={on}
        aria-label="プレゼンテーション機能"
        title={on ? "ON（クリックで OFF）" : "OFF（クリックで ON）"}
        className="group inline-flex items-center gap-2"
      >
        <span
          className={`relative inline-block h-5 w-9 rounded-full transition-colors ${
            on ? "bg-brand-500" : "bg-gray-300"
          }`}
        >
          <span
            className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all ${
              on ? "left-[18px]" : "left-0.5"
            }`}
          />
        </span>
        <span className={`text-xs ${on ? "font-medium text-gray-800" : "text-gray-400"}`}>
          {on ? "ON" : "OFF"}
        </span>
      </button>
    </fetcher.Form>
  );
}

export default function PortalSlides() {
  const { user, slides, canUpload, isAdmin } = useLoaderData<typeof loader>();
  const [searchParams] = useSearchParams();
  const denied = searchParams.get("denied") === "1";

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b bg-white">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-4">
            <Link to="/" className="text-lg font-bold text-gray-900 hover:text-brand-600">
              Cloudflare Field Notes
            </Link>
            <span className="text-sm text-gray-400">|</span>
            <Link to="/portal" className="text-sm text-gray-500 hover:text-gray-700">
              ← ダッシュボード
            </Link>
          </div>
          <span className="text-sm text-gray-500">{user.displayName}</span>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">スライド管理</h1>
            <p className="mt-1 text-sm text-gray-500">
              アップロードした HTML スライドの管理
            </p>
          </div>
          {canUpload && (
            <Link
              to="/portal/slides/new"
              className="rounded-lg bg-brand-500 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-600"
            >
              + アップロード
            </Link>
          )}
        </div>

        {denied && (
          <div className="mb-6 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800">
            スライドのアップロードには権限が必要です。管理者に許可を依頼してください。
          </div>
        )}

        {!canUpload && (
          <div className="mb-6 rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm text-gray-600">
            スライドのアップロードは、Cloudflare SE および管理者が許可したユーザーに限定されています。
            アップロードを希望される場合は管理者にお問い合わせください。
          </div>
        )}

        {slides.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-300 bg-white p-16 text-center">
            <p className="text-gray-500">まだスライドをアップロードしていません。</p>
            {canUpload && (
              <Link
                to="/portal/slides/new"
                className="mt-4 inline-block rounded-lg bg-brand-500 px-6 py-2 text-sm font-medium text-white hover:bg-brand-600"
              >
                最初のスライドをアップロード
              </Link>
            )}
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
            <table className="w-full text-sm">
              <thead className="whitespace-nowrap border-b bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-4 py-3">タイトル</th>
                  {isAdmin && <th className="px-4 py-3">制作者</th>}
                  <th className="px-4 py-3">状態</th>
                  <th className="px-4 py-3">発表機能</th>
                  <th className="px-4 py-3">スライド数</th>
                  <th className="px-4 py-3">表示</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {slides.map((s) => (
                  <tr key={s.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <Link to={`/slides/${s.slug}`} className="font-medium text-gray-900 hover:text-brand-600">
                        {s.title}
                      </Link>
                      <span className="ml-2 text-xs text-gray-400">
                        {SLIDE_CATEGORY_LABEL[parseSlideCategory(s.category)]}
                        {s.eventName ? ` · ${s.eventName}` : ""}
                      </span>
                    </td>
                    {isAdmin && (
                      <td className="px-4 py-3 text-gray-600">{s.authorName}</td>
                    )}
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          s.status === "published"
                            ? "bg-green-100 text-green-700"
                            : "bg-gray-100 text-gray-600"
                        }`}
                      >
                        {s.status === "published" ? "公開" : "下書き"}
                      </span>
                      {s.visibility === "limited" && (
                        <span className="ml-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
                          限定
                        </span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <PresenterToggle id={s.id} enabled={!!s.presenterEnabled} />
                    </td>
                    <td className="px-4 py-3 text-gray-600">{s.slideCount}</td>
                    <td className="px-4 py-3 text-gray-600">{s.viewCount}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-3 whitespace-nowrap">
                        <a
                          href={`/slides/${s.slug}/view`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs text-gray-500 hover:text-brand-600"
                        >
                          開く
                        </a>
                        {s.presenterEnabled && (
                          <a
                            href={`/slides/${s.slug}/present`}
                            className="text-xs font-medium text-gray-700 hover:text-brand-600"
                          >
                            発表
                          </a>
                        )}
                        <Link
                          to={`/portal/slides/${s.id}/notes`}
                          className="text-xs font-medium text-gray-700 hover:text-brand-600"
                        >
                          ノート
                        </Link>
                        <Link
                          to={`/portal/slides/${s.id}/edit`}
                          className="text-xs font-medium text-brand-600 hover:text-brand-700"
                        >
                          編集
                        </Link>
                        <Form method="post" onSubmit={(e) => {
                          if (!confirm("このスライドを削除しますか？")) e.preventDefault();
                        }}>
                          <input type="hidden" name="intent" value="delete" />
                          <input type="hidden" name="id" value={s.id} />
                          <button type="submit" className="text-xs text-red-500 hover:text-red-700">
                            削除
                          </button>
                        </Form>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  );
}
