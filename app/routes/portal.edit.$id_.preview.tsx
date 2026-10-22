import type { ActionFunctionArgs } from "@remix-run/cloudflare";
import { json } from "@remix-run/cloudflare";
import { requireUser } from "~/lib/auth.server";
import { getPostById } from "~/lib/posts.server";
import { writeAuditLog } from "~/lib/audit.server";
import { sendPreviewInviteEmail } from "~/lib/email.server";
import {
  createPreviewGrant,
  getPreviewGrant,
  grantState,
  isPreviewAccessConfigured,
  markPreviewEmailSent,
  normalizePreviewEmail,
  previewUrl,
  revokePreviewGrant,
  syncPreviewAccessPolicy,
  type PreviewGrantRow,
} from "~/lib/preview.server";
import { PREVIEW_DEFAULT_DAYS } from "~/lib/preview-invite";

// POST /portal/edit/:id/preview — issue / revoke / resend preview links.
// Only the author of the post and admins (same rule as the edit page).

export type PreviewActionResult = { ok?: string; warning?: string; error?: string };

const MAX_MESSAGE = 1000;

function isLocal(request: Request): boolean {
  const host = new URL(request.url).hostname;
  return host === "localhost" || host === "127.0.0.1";
}

export async function action({ params, request, context }: ActionFunctionArgs) {
  const env = context.cloudflare.env;
  const user = await requireUser(request, env);
  const post = params.id ? await getPostById(env.DB, params.id) : null;
  if (!post) throw new Response("Not Found", { status: 404 });
  if (post.author_id !== user.id && user.role !== "admin") throw new Response("Forbidden", { status: 403 });

  const form = await request.formData();
  const intent = String(form.get("intent") ?? "");
  const ip = request.headers.get("CF-Connecting-IP") ?? undefined;

  const sendInvite = async (grant: PreviewGrantRow, message?: string) => {
    const result = await sendPreviewInviteEmail(env, {
      title: post.title,
      url: previewUrl(env, grant.id),
      email: grant.email,
      expiresAt: grant.expires_at,
      inviterName: user.displayName,
      message,
      siteName: env.SITE_NAME,
    });
    if (result.success) await markPreviewEmailSent(env.DB, grant.id);
    return result;
  };

  if (intent === "create") {
    const email = normalizePreviewEmail(String(form.get("email") ?? ""));
    if (!email) return json<PreviewActionResult>({ error: "メールアドレスの形式が正しくありません。" }, { status: 400 });
    const days = Number(form.get("days") ?? PREVIEW_DEFAULT_DAYS);
    const message = String(form.get("message") ?? "").slice(0, MAX_MESSAGE);
    const notify = form.get("notify") === "on";

    if (!isPreviewAccessConfigured(env) && !isLocal(request)) {
      return json<PreviewActionResult>(
        { error: "プレビュー用の Access が設定されていません（CF_ACCESS_PREVIEW_AUD）。管理者に連絡してください。" },
        { status: 503 }
      );
    }

    let grant: PreviewGrantRow;
    try {
      grant = await createPreviewGrant(env.DB, { postId: post.id, email, days, userId: user.id });
    } catch (e: any) {
      return json<PreviewActionResult>({ error: e?.message ?? "発行に失敗しました。" }, { status: 400 });
    }

    const sync = await syncPreviewAccessPolicy(env);
    if (!sync.success && !(sync.skipped && isLocal(request))) {
      // Without the policy entry the reviewer cannot pass Access; do not leave a dead link.
      await env.DB.prepare("DELETE FROM preview_grants WHERE id = ?").bind(grant.id).run();
      console.error("[Preview] policy sync failed:", sync.error);
      return json<PreviewActionResult>(
        { error: `Access ポリシーの更新に失敗したため、発行を取り消しました。${sync.error ?? ""}` },
        { status: 502 }
      );
    }

    await writeAuditLog(env.DB, {
      userId: user.id,
      action: "preview.grant",
      resourceType: "post",
      resourceId: post.id,
      details: { grantId: grant.id, email, days, notify },
      ip,
    });

    if (!notify) return json<PreviewActionResult>({ ok: `${email} にプレビューリンクを発行しました。案内文をコピーして送ってください。` });
    const mail = await sendInvite(grant, message);
    if (!mail.success) {
      return json<PreviewActionResult>({
        warning: `リンクは発行しましたが、案内メールを送信できませんでした（${mail.error}）。案内文をコピーして送ってください。`,
      });
    }
    return json<PreviewActionResult>({ ok: `${email} にプレビューリンクを発行し、案内メールを送信しました。` });
  }

  const grantId = String(form.get("grantId") ?? "");
  const grant = grantId ? await getPreviewGrant(env.DB, grantId) : null;
  if (!grant || grant.post_id !== post.id) {
    return json<PreviewActionResult>({ error: "プレビューリンクが見つかりません。" }, { status: 404 });
  }

  if (intent === "revoke") {
    await revokePreviewGrant(env.DB, post.id, grant.id);
    const sync = await syncPreviewAccessPolicy(env);
    await writeAuditLog(env.DB, {
      userId: user.id,
      action: "preview.revoke",
      resourceType: "post",
      resourceId: post.id,
      details: { grantId: grant.id, email: grant.email },
      ip,
    });
    if (!sync.success && !sync.skipped) {
      return json<PreviewActionResult>({
        warning: `リンクを取り消しました（閲覧はできません）。Access ポリシーからの削除は失敗したため、次回の発行時に再試行します。${sync.error ?? ""}`,
      });
    }
    return json<PreviewActionResult>({ ok: `${grant.email} のプレビューリンクを取り消しました。` });
  }

  if (intent === "resend") {
    if (grantState(grant) !== "active") {
      return json<PreviewActionResult>({ error: "有効期限切れ、または取り消し済みのリンクには送信できません。" }, { status: 400 });
    }
    const mail = await sendInvite(grant);
    await writeAuditLog(env.DB, {
      userId: user.id,
      action: "preview.resend",
      resourceType: "post",
      resourceId: post.id,
      details: { grantId: grant.id, email: grant.email, success: mail.success },
      ip,
    });
    return mail.success
      ? json<PreviewActionResult>({ ok: `${grant.email} に案内メールを再送しました。` })
      : json<PreviewActionResult>({ error: `案内メールを送信できませんでした（${mail.error}）。` }, { status: 502 });
  }

  return json<PreviewActionResult>({ error: "不正な操作です。" }, { status: 400 });
}
