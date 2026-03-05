export async function sendApprovalEmail(
  env: Env,
  to: string,
  displayName: string
): Promise<{ success: boolean; error?: string }> {
  if (!env.EMAIL_WORKER) {
    return { success: false, error: "EMAIL_WORKER binding が設定されていません" };
  }

  try {
    const loginUrl = `${env.SITE_URL || "https://cf-se-blog-jp.dev"}/portal`;
    const siteUrl = env.SITE_URL || "https://cf-se-blog-jp.dev";

    const res = await env.EMAIL_WORKER.fetch("https://email-worker/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        to,
        subject: "【Cloudflare Solution Blog】投稿者アカウントが承認されました",
        text: [
          `${displayName} さん`,
          "",
          "Cloudflare Solution Blog への投稿者申請が承認されました。",
          "以下のリンクからログインして、記事の投稿を始めることができます。",
          "",
          `ログイン: ${loginUrl}`,
          "",
          "ログインには Cloudflare Access の認証が必要です。",
          "申請時にご登録いただいたメールアドレスでログインしてください。",
          "",
          "---",
          "Cloudflare Solution Blog",
          siteUrl,
        ].join("\n"),
        html: `<!DOCTYPE html>
<html lang="ja">
<head><meta charset="utf-8"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #1a1a1a;">
  <div style="border-bottom: 3px solid #f6821f; padding-bottom: 16px; margin-bottom: 24px;">
    <h1 style="font-size: 18px; margin: 0; color: #1a1a1a;">Cloudflare Solution Blog</h1>
  </div>
  <p style="font-size: 15px;">${displayName} さん</p>
  <p style="font-size: 15px; line-height: 1.7;">
    Cloudflare Solution Blog への投稿者申請が<strong style="color: #16a34a;">承認</strong>されました。<br>
    以下のボタンからログインして、記事の投稿を始めることができます。
  </p>
  <div style="text-align: center; margin: 32px 0;">
    <a href="${loginUrl}" style="display: inline-block; background: #1a1a1a; color: #fff; padding: 12px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 14px;">
      ログインして投稿を始める
    </a>
  </div>
  <p style="font-size: 13px; color: #6b7280; line-height: 1.6;">
    ログインには Cloudflare Access の認証が必要です。<br>
    申請時にご登録いただいたメールアドレス（${to}）でログインしてください。
  </p>
  <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;">
  <p style="font-size: 12px; color: #9ca3af;">
    Cloudflare Solution Blog — <a href="${siteUrl}" style="color: #9ca3af;">${siteUrl}</a>
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
