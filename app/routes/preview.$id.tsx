import type { HeadersFunction, LoaderFunctionArgs, MetaFunction } from "@remix-run/cloudflare";
import { json } from "@remix-run/cloudflare";
import { useLoaderData } from "@remix-run/react";
import { getPostById, getPostBySlug } from "~/lib/posts.server";
import { renderMarkdown } from "~/lib/markdown.server";
import { issueGuideToken } from "~/lib/guide-token.server";
import {
  getPreviewGrant,
  grantState,
  isValidGrantId,
  maskEmail,
  recordPreviewView,
  syncPreviewAccessPolicy,
  verifyPreviewViewer,
} from "~/lib/preview.server";
import { formatPreviewExpiry } from "~/lib/preview-invite";
import { CASE_KINDS, caseKind } from "~/lib/case-kind";

// Reviewer-facing page for a preview grant. Protected at the edge by the
// preview Access application (One-time PIN); authorised here per grant.
// Never creates a site session (root.tsx skips /preview/).

type Blocked = {
  blocked: true;
  kind: "invalid" | "expired" | "revoked" | "mismatch" | "not_configured" | "no_identity";
  expiresAt?: string;
  grantEmail?: string;
  viewerEmail?: string;
};

const PRIVATE_HEADERS = {
  "Cache-Control": "private, no-store",
  "X-Robots-Tag": "noindex, nofollow",
  "Referrer-Policy": "no-referrer",
};

function blocked(data: Omit<Blocked, "blocked">, status: number) {
  return json({ blocked: true as const, ...data } as Blocked, { status, headers: PRIVATE_HEADERS });
}

export async function loader({ params, request, context }: LoaderFunctionArgs) {
  const env = context.cloudflare.env;
  if (!isValidGrantId(params.id)) return blocked({ kind: "invalid" }, 404);
  const grant = await getPreviewGrant(env.DB, params.id);
  if (!grant) return blocked({ kind: "invalid" }, 404);

  const state = grantState(grant);
  if (state !== "active") {
    // Drop the address from the Access policy if no other grant needs it.
    const sync = syncPreviewAccessPolicy(env).then((r) => {
      if (!r.success && !r.skipped) console.error("[Preview] policy sync failed:", r.error);
    });
    context.cloudflare.ctx?.waitUntil?.(sync);
    return blocked({ kind: state, expiresAt: grant.expires_at }, 410);
  }

  const viewer = await verifyPreviewViewer(request, env, grant.email);
  if (!viewer.ok) {
    return blocked({ kind: viewer.reason === "not_configured" ? "not_configured" : "no_identity" }, viewer.reason === "not_configured" ? 503 : 401);
  }
  if (viewer.email !== grant.email) {
    return blocked({ kind: "mismatch", grantEmail: maskEmail(grant.email), viewerEmail: viewer.email }, 403);
  }

  const row = await getPostById(env.DB, grant.post_id);
  if (!row) return blocked({ kind: "invalid" }, 404);
  const post = await getPostBySlug(env.DB, row.slug);
  if (!post) return blocked({ kind: "invalid" }, 404);

  const view = recordPreviewView(env.DB, grant.id).catch((e) => console.error("[Preview] view count failed:", e));
  context.cloudflare.ctx?.waitUntil?.(view);

  const isGuide = row.content_type === "case_guide";
  const base = {
    blocked: false as const,
    expiresAt: grant.expires_at,
    viewerEmail: viewer.email,
    dev: viewer.ok && viewer.dev === true,
    post: {
      title: post.title,
      status: post.status,
      authorName: post.authorName,
      updatedAt: post.updatedAt,
      isGuide,
    },
  };
  if (isGuide) {
    // Short-lived so a revoked/expired grant stops working soon even if the
    // iframe URL was kept: at most 2 hours, never past the grant's expiry.
    const untilExpiry = (Date.parse(`${grant.expires_at.replace(" ", "T")}Z`) - Date.now()) / 1000;
    const token = await issueGuideToken(row.id, row.asset_prefix, Math.min(2 * 60 * 60, untilExpiry));
    return json({ ...base, src: `/cases/${row.slug}/a/${token}/`, contentHtml: null }, { headers: PRIVATE_HEADERS });
  }
  return json({ ...base, src: null, contentHtml: renderMarkdown(row.content) }, { headers: PRIVATE_HEADERS });
}

export const headers: HeadersFunction = ({ loaderHeaders }) => loaderHeaders;

export const meta: MetaFunction<typeof loader> = ({ data }) => [
  { title: data && !data.blocked ? `プレビュー: ${data.post.title}` : "プレビュー — Cloudflare フィールドノート" },
  { name: "robots", content: "noindex, nofollow" },
];

const MESSAGES: Record<Blocked["kind"], { title: string; body: string }> = {
  invalid: { title: "リンクが見つかりません", body: "URL が正しいか確認してください。リンクが削除された可能性があります。" },
  expired: { title: "プレビューの有効期限が切れました", body: "引き続き閲覧が必要な場合は、ご案内した担当者に再発行を依頼してください。" },
  revoked: { title: "このプレビューリンクは取り消されました", body: "閲覧が必要な場合は、ご案内した担当者にお問い合わせください。" },
  mismatch: { title: "このリンクは別のメールアドレス宛てです", body: "" },
  not_configured: { title: "プレビューを表示できません", body: "プレビュー機能の設定が完了していません。ご案内した担当者にお問い合わせください。" },
  no_identity: { title: "本人確認が完了していません", body: "ページを再読み込みし、Cloudflare Access の画面でメールアドレスとコードを入力してください。" },
};

function BlockedView({ data }: { data: Blocked }) {
  const m = MESSAGES[data.kind];
  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="max-w-lg rounded-2xl border border-gray-200 bg-white p-10 text-center shadow-sm">
        <p className="text-xs font-extrabold tracking-[0.14em] text-brand-500">PREVIEW</p>
        <h1 className="mt-2 text-xl font-bold text-gray-900">{m.title}</h1>
        {data.kind === "mismatch" ? (
          <p className="mt-4 text-sm leading-relaxed text-gray-600">
            このリンクは <b>{data.grantEmail}</b> 宛てに発行されています。
            現在 <b>{data.viewerEmail}</b> で認証されています。
            宛先のメールアドレスで認証し直してください。
          </p>
        ) : (
          <p className="mt-4 text-sm leading-relaxed text-gray-600">{m.body}</p>
        )}
        {data.expiresAt && (data.kind === "expired" || data.kind === "revoked") && (
          <p className="mt-2 text-xs text-gray-400">有効期限: {formatPreviewExpiry(data.expiresAt)}（日本時間）</p>
        )}
        {data.kind === "mismatch" && (
          <a
            href="/cdn-cgi/access/logout"
            className="mt-6 inline-block rounded-lg bg-gray-900 px-6 py-2.5 text-sm font-semibold text-white hover:bg-gray-800"
          >
            ログアウトして認証し直す
          </a>
        )}
      </div>
    </main>
  );
}

export default function PreviewPage() {
  const data = useLoaderData<typeof loader>();
  if (data.blocked) return <BlockedView data={data as Blocked} />;
  const { post } = data;
  const kindLabel = post.isGuide ? `事例 - ${CASE_KINDS[caseKind(post.title)].label}` : "記事";

  return (
    <div className="flex h-screen flex-col bg-white">
      <header className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-1 border-b bg-amber-50 px-4 py-2.5 text-xs">
        <span className="rounded-full bg-amber-500 px-2.5 py-0.5 font-bold text-white">プレビュー</span>
        <span className="text-amber-900">
          公開前の内容です。取り扱いにご注意ください。有効期限: {formatPreviewExpiry(data.expiresAt)}（日本時間）まで
        </span>
        <span className="ml-auto text-amber-800/70">
          {data.viewerEmail}
          {data.dev ? "（ローカル確認用）" : ""}
        </span>
      </header>
      {post.isGuide && data.src ? (
        <iframe
          src={data.src}
          title={post.title}
          sandbox="allow-scripts allow-popups allow-popups-to-escape-sandbox"
          referrerPolicy="no-referrer"
          className="w-full flex-1 border-0"
        />
      ) : (
        <div className="flex-1 overflow-y-auto">
          <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
            <div className="mb-3 flex flex-wrap items-center gap-2 text-xs">
              <span className="rounded-full bg-gray-100 px-2 py-0.5 font-semibold text-gray-600">{kindLabel}</span>
              {post.status !== "published" && (
                <span className="rounded-full bg-gray-200 px-2 py-0.5 font-semibold text-gray-700">下書き</span>
              )}
            </div>
            <h1 className="text-3xl font-bold leading-tight text-gray-900">{post.title}</h1>
            <p className="mt-3 text-sm text-gray-500">
              {post.authorName}
              {post.updatedAt ? ` · 最終更新 ${new Date(post.updatedAt).toLocaleDateString("ja-JP")}` : ""}
            </p>
            <article className="prose prose-lg prose-gray mt-8 max-w-none prose-headings:font-bold prose-headings:text-gray-900 prose-p:leading-relaxed prose-a:text-brand-600 prose-a:no-underline hover:prose-a:underline prose-code:rounded prose-code:bg-gray-100 prose-code:px-1.5 prose-code:py-0.5 prose-code:text-sm prose-code:before:content-none prose-code:after:content-none prose-pre:bg-gray-900 prose-pre:text-gray-100 [&_pre_code]:bg-transparent [&_pre_code]:p-0 [&_pre_code]:text-inherit prose-img:rounded-xl prose-img:shadow-md prose-table:text-sm prose-th:bg-gray-50 prose-th:px-4 prose-th:py-2 prose-td:px-4 prose-td:py-2">
              <div dangerouslySetInnerHTML={{ __html: data.contentHtml ?? "" }} />
            </article>
          </main>
        </div>
      )}
    </div>
  );
}
