import {
  buildPreviewInviteHtml,
  buildPreviewInviteSubject,
  buildPreviewInviteText,
  type PreviewInviteInput,
} from "~/lib/preview-invite";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function emailWorkerHeaders(env: Env): Record<string, string> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (env.EMAIL_WORKER_SECRET) headers.Authorization = `Bearer ${env.EMAIL_WORKER_SECRET}`;
  return headers;
}

export async function sendApprovalEmail(
  env: Env,
  to: string,
  displayName: string
): Promise<{ success: boolean; error?: string }> {
  if (!env.EMAIL_WORKER_URL) {
    return { success: false, error: "EMAIL_WORKER_URL が設定されていません" };
  }

  try {
    const loginUrl = `${env.SITE_URL || "https://cf-se-blog-jp.dev"}/portal`;
    const siteUrl = env.SITE_URL || "https://cf-se-blog-jp.dev";

    const res = await fetch(env.EMAIL_WORKER_URL, {
      method: "POST",
      headers: emailWorkerHeaders(env),
      body: JSON.stringify({
        to,
        subject: "【Cloudflare Field Notes】投稿者アカウントが承認されました",
        text: [
          `${displayName} さん`,
          "",
          "Cloudflare フィールドノートへの投稿者申請が承認されました。",
          "以下のリンクからログインして、記事の投稿を始めることができます。",
          "",
          `ログイン: ${loginUrl}`,
          "",
          "ログインには Cloudflare Access の認証が必要です。",
          "申請時にご登録いただいたメールアドレスでログインしてください。",
          "",
          "---",
          "Cloudflare Field Notes",
          siteUrl,
        ].join("\n"),
        html: `<!DOCTYPE html>
<html lang="ja">
<head><meta charset="utf-8"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #1a1a1a;">
  <div style="border-bottom: 3px solid #f6821f; padding-bottom: 16px; margin-bottom: 24px;">
    <h1 style="font-size: 18px; margin: 0; color: #1a1a1a;">Cloudflare Field Notes</h1>
  </div>
  <p style="font-size: 15px;">${escapeHtml(displayName)} さん</p>
  <p style="font-size: 15px; line-height: 1.7;">
    Cloudflare フィールドノートへの投稿者申請が<strong style="color: #16a34a;">承認</strong>されました。<br>
    以下のボタンからログインして、記事の投稿を始めることができます。
  </p>
  <div style="text-align: center; margin: 32px 0;">
    <a href="${loginUrl}" style="display: inline-block; background: #1a1a1a; color: #fff; padding: 12px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 14px;">
      ログインして投稿を始める
    </a>
  </div>
  <p style="font-size: 13px; color: #6b7280; line-height: 1.6;">
    ログインには Cloudflare Access の認証が必要です。<br>
    申請時にご登録いただいたメールアドレス（${escapeHtml(to)}）でログインしてください。
  </p>
  <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;">
  <p style="font-size: 12px; color: #9ca3af;">
    Cloudflare Field Notes — <a href="${siteUrl}" style="color: #9ca3af;">${siteUrl}</a>
  </p>
</body>
</html>`,
      }),
    });

    const result = await res.json() as any;
    if (!result.success) {
      return { success: false, error: `Email Worker エラー: ${result.error}` };
    }

    return { success: true };
  } catch (e: any) {
    console.error("[Email] Failed to send approval email:", e);
    return { success: false, error: `メール送信エラー: ${e.message}` };
  }
}

/**
 * Preview invitation to an arbitrary (external) address. Requires the sending
 * domain to be onboarded to Cloudflare Email Sending; otherwise only verified
 * Email Routing destinations can receive it and the send fails.
 */
export async function sendPreviewInviteEmail(
  env: Env,
  invite: PreviewInviteInput
): Promise<{ success: boolean; error?: string }> {
  if (!env.EMAIL_WORKER_URL) return { success: false, error: "EMAIL_WORKER_URL が設定されていません" };
  try {
    const res = await fetch(env.EMAIL_WORKER_URL, {
      method: "POST",
      headers: emailWorkerHeaders(env),
      body: JSON.stringify({
        to: invite.email,
        subject: buildPreviewInviteSubject(invite),
        text: buildPreviewInviteText(invite),
        html: buildPreviewInviteHtml(invite),
      }),
    });
    const result = (await res.json().catch(() => ({}))) as { success?: boolean; error?: string };
    if (!res.ok || !result.success) {
      return { success: false, error: `Email Worker エラー: ${result.error ?? res.status}` };
    }
    return { success: true };
  } catch (e: any) {
    console.error("[Email] Failed to send preview invite:", e);
    return { success: false, error: `メール送信エラー: ${e?.message ?? e}` };
  }
}

/**
 * Double opt-in mail for /apply. The application reaches admins only after the
 * applicant opens `verifyUrl` and presses the confirm button.
 */
export async function sendApplyVerificationEmail(
  env: Env,
  to: string,
  displayName: string,
  verifyUrl: string
): Promise<{ success: boolean; error?: string }> {
  if (!env.EMAIL_WORKER_URL) {
    return { success: false, error: "EMAIL_WORKER_URL が設定されていません" };
  }
  const siteUrl = env.SITE_URL || "https://cf-se-blog-jp.dev";
  const name = displayName.slice(0, 80);
  try {
    const res = await fetch(env.EMAIL_WORKER_URL, {
      method: "POST",
      headers: emailWorkerHeaders(env),
      body: JSON.stringify({
        to,
        subject: "【Cloudflare Field Notes】投稿者申請のメールアドレス確認",
        text: [
          `${name} さん`,
          "",
          "Cloudflare Field Notes への投稿者申請を受け付けました。",
          "24 時間以内に以下のリンクを開き、「申請を確定する」ボタンを押してください。",
          "確定後に管理者が申請内容を確認します。",
          "",
          verifyUrl,
          "",
          "このメールに心当たりがない場合は、何もせずに破棄してください。",
          "申請は確定されず、24 時間後に自動で削除されます。",
          "",
          "---",
          "Cloudflare Field Notes",
          siteUrl,
        ].join("\n"),
        html: `<!DOCTYPE html>
<html lang="ja">
<head><meta charset="utf-8"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #1a1a1a;">
  <div style="border-bottom: 3px solid #f6821f; padding-bottom: 16px; margin-bottom: 24px;">
    <h1 style="font-size: 18px; margin: 0; color: #1a1a1a;">Cloudflare Field Notes</h1>
  </div>
  <p style="font-size: 15px;">${escapeHtml(name)} さん</p>
  <p style="font-size: 15px; line-height: 1.7;">
    投稿者申請を受け付けました。<br>
    <strong>24 時間以内</strong>に下のボタンからページを開き、「申請を確定する」を押してください。確定後に管理者が申請内容を確認します。
  </p>
  <div style="text-align: center; margin: 32px 0;">
    <a href="${escapeHtml(verifyUrl)}" style="display: inline-block; background: #f6821f; color: #fff; text-decoration: none; padding: 12px 32px; border-radius: 8px; font-weight: 600; font-size: 15px;">メールアドレスを確認する</a>
  </div>
  <p style="font-size: 13px; color: #6b7280; line-height: 1.6;">
    このメールに心当たりがない場合は、何もせずに破棄してください。申請は確定されず、24 時間後に自動で削除されます。
  </p>
  <div style="border-top: 1px solid #e5e7eb; margin-top: 32px; padding-top: 16px; font-size: 12px; color: #9ca3af;">
    Cloudflare Field Notes — <a href="${escapeHtml(siteUrl)}" style="color: #9ca3af;">${escapeHtml(siteUrl)}</a>
  </div>
</body>
</html>`,
      }),
    });
    const data = (await res.json().catch(() => ({}))) as { success?: boolean; error?: string };
    if (!res.ok || !data.success) {
      return { success: false, error: data.error || `Email Worker HTTP ${res.status}` };
    }
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e?.message ?? String(e) };
  }
}
