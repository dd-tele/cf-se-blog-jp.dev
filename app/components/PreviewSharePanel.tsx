import { useEffect, useRef, useState } from "react";
import { useFetcher } from "@remix-run/react";
import {
  PREVIEW_DAY_OPTIONS,
  PREVIEW_DEFAULT_DAYS,
  buildPreviewInviteSubject,
  buildPreviewInviteText,
  formatPreviewExpiry,
} from "~/lib/preview-invite";

export interface PreviewGrantView {
  id: string;
  email: string;
  url: string;
  expiresAt: string;
  createdAt: string;
  state: "active" | "expired" | "revoked";
  emailSentAt: string | null;
  lastViewedAt: string | null;
  viewCount: number;
}

type Result = { ok?: string; warning?: string; error?: string };

const STATE_LABEL: Record<PreviewGrantView["state"], { label: string; cls: string }> = {
  active: { label: "有効", cls: "bg-green-100 text-green-700" },
  expired: { label: "期限切れ", cls: "bg-gray-100 text-gray-500" },
  revoked: { label: "取り消し済み", cls: "bg-gray-100 text-gray-500" },
};

export function PreviewSharePanel({
  postId,
  title,
  grants,
  inviterName,
  siteName,
  configured,
}: {
  postId: string;
  title: string;
  grants: PreviewGrantView[];
  inviterName: string;
  siteName: string;
  configured: boolean;
}) {
  const fetcher = useFetcher<Result>();
  const formRef = useRef<HTMLFormElement>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [showInactive, setShowInactive] = useState(false);
  const action = `/portal/edit/${postId}/preview`;
  const busy = fetcher.state !== "idle";

  useEffect(() => {
    if (fetcher.state === "idle" && fetcher.data?.ok !== undefined) formRef.current?.reset();
  }, [fetcher.state, fetcher.data]);

  const copy = async (key: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      window.setTimeout(() => setCopied((c) => (c === key ? null : c)), 2000);
    } catch {
      window.prompt("コピーしてください", text);
    }
  };

  const inviteFor = (g: PreviewGrantView) => {
    const input = { title, url: g.url, email: g.email, expiresAt: g.expiresAt, inviterName, siteName };
    return `件名: ${buildPreviewInviteSubject(input)}\n\n${buildPreviewInviteText(input)}`;
  };

  const active = grants.filter((g) => g.state === "active");
  const inactive = grants.filter((g) => g.state !== "active");
  const visible = showInactive ? grants : active;

  return (
    <section className="mt-8 rounded-xl border border-gray-200 bg-white p-5">
      <h2 className="text-sm font-semibold text-gray-900">プレビューを共有</h2>
      <p className="mt-1 text-xs leading-relaxed text-gray-500">
        指定したメールアドレスの方だけが、期限まで、この記事を下書きのまま閲覧できます。閲覧時は Cloudflare Access の
        One-time PIN でメールアドレスを確認します。サイトへのログインや、ほかの記事の閲覧はできません。
      </p>

      {!configured && (
        <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
          プレビュー用の Access が設定されていないため、発行できません（管理者向け: docs/DEPLOY.md「プレビュー共有」）。
        </p>
      )}
      {fetcher.data?.error && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{fetcher.data.error}</p>}
      {fetcher.data?.warning && <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">{fetcher.data.warning}</p>}
      {fetcher.data?.ok && <p className="mt-3 rounded-lg bg-green-50 px-3 py-2 text-xs text-green-700">{fetcher.data.ok}</p>}

      <fetcher.Form ref={formRef} method="post" action={action} className="mt-4 space-y-3">
        <input type="hidden" name="intent" value="create" />
        <div className="flex flex-wrap gap-3">
          <input
            type="email"
            name="email"
            required
            placeholder="reviewer@example.com"
            disabled={!configured}
            className="min-w-[16rem] flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
          <label className="flex items-center gap-2 text-sm text-gray-600">
            有効期限
            <select
              name="days"
              defaultValue={PREVIEW_DEFAULT_DAYS}
              disabled={!configured}
              className="rounded-lg border border-gray-300 px-2 py-2 text-sm"
            >
              {PREVIEW_DAY_OPTIONS.map((d) => (
                <option key={d} value={d}>
                  {d} 日
                </option>
              ))}
            </select>
          </label>
        </div>
        <textarea
          name="message"
          rows={2}
          maxLength={1000}
          placeholder="案内メールに添えるメッセージ（任意）"
          disabled={!configured}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
        />
        <div className="flex flex-wrap items-center justify-between gap-3">
          <label className="flex items-center gap-2 text-sm text-gray-600">
            <input type="checkbox" name="notify" defaultChecked disabled={!configured} className="rounded border-gray-300" />
            サイトから案内メールを送る
          </label>
          <button
            type="submit"
            disabled={busy || !configured}
            className="rounded-lg bg-gray-900 px-5 py-2 text-sm font-semibold text-white hover:bg-gray-800 disabled:opacity-50"
          >
            {busy && fetcher.formData?.get("intent") === "create" ? "発行中..." : "リンクを発行"}
          </button>
        </div>
      </fetcher.Form>

      <div className="mt-6">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-xs font-semibold text-gray-700">発行済みのリンク（有効 {active.length} 件）</h3>
          {inactive.length > 0 && (
            <button type="button" onClick={() => setShowInactive((v) => !v)} className="text-xs text-gray-500 hover:text-gray-700">
              {showInactive ? "有効なリンクのみ表示" : `期限切れ・取り消し済みも表示（${inactive.length} 件）`}
            </button>
          )}
        </div>
        {visible.length === 0 ? (
          <p className="rounded-lg border border-dashed border-gray-200 px-3 py-4 text-center text-xs text-gray-400">
            有効なプレビューリンクはありません。
          </p>
        ) : (
          <ul className="divide-y rounded-lg border border-gray-200">
            {visible.map((g) => (
              <li key={g.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-3 py-3 text-xs">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className={`rounded-full px-2 py-0.5 font-semibold ${STATE_LABEL[g.state].cls}`}>{STATE_LABEL[g.state].label}</span>
                    <span className="truncate font-medium text-gray-900">{g.email}</span>
                  </div>
                  <p className="mt-1 text-gray-500">
                    期限 {formatPreviewExpiry(g.expiresAt)}
                    {" · "}
                    {g.emailSentAt ? "メール送信済み" : "メール未送信"}
                    {" · "}
                    {g.viewCount > 0 ? `閲覧 ${g.viewCount} 回（最終 ${formatPreviewExpiry(g.lastViewedAt!)}）` : "未閲覧"}
                  </p>
                </div>
                {g.state === "active" && (
                  <div className="flex shrink-0 flex-wrap gap-2">
                    <button type="button" onClick={() => copy(`url-${g.id}`, g.url)} className="rounded border border-gray-300 px-2.5 py-1 text-gray-700 hover:bg-gray-50">
                      {copied === `url-${g.id}` ? "コピーしました" : "リンクをコピー"}
                    </button>
                    <button type="button" onClick={() => copy(`inv-${g.id}`, inviteFor(g))} className="rounded border border-gray-300 px-2.5 py-1 text-gray-700 hover:bg-gray-50">
                      {copied === `inv-${g.id}` ? "コピーしました" : "案内文をコピー"}
                    </button>
                    <fetcher.Form method="post" action={action}>
                      <input type="hidden" name="intent" value="resend" />
                      <input type="hidden" name="grantId" value={g.id} />
                      <button type="submit" disabled={busy} className="rounded border border-gray-300 px-2.5 py-1 text-gray-700 hover:bg-gray-50 disabled:opacity-50">
                        メール再送
                      </button>
                    </fetcher.Form>
                    <fetcher.Form
                      method="post"
                      action={action}
                      onSubmit={(e) => {
                        if (!confirm(`${g.email} のプレビューリンクを取り消しますか？`)) e.preventDefault();
                      }}
                    >
                      <input type="hidden" name="intent" value="revoke" />
                      <input type="hidden" name="grantId" value={g.id} />
                      <button type="submit" disabled={busy} className="rounded border border-red-200 px-2.5 py-1 text-red-600 hover:bg-red-50 disabled:opacity-50">
                        取り消し
                      </button>
                    </fetcher.Form>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
