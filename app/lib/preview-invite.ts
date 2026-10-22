// Invitation text for a preview link. Shared by the invitation email (server)
// and the "copy invitation" button on the edit page (client), so both say the
// same thing.

export const PREVIEW_DAY_OPTIONS = [1, 3, 7, 14] as const;
export const PREVIEW_DEFAULT_DAYS = 7;

/** "2026/10/29 18:00" in Japan time. `utc` is SQLite 'YYYY-MM-DD HH:MM:SS' (UTC). */
export function formatPreviewExpiry(utc: string): string {
  const d = new Date(`${utc.replace(" ", "T")}Z`);
  return new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

export interface PreviewInviteInput {
  title: string;
  url: string;
  email: string;
  expiresAt: string; // SQLite UTC
  inviterName: string;
  message?: string;
  siteName?: string;
}

export function buildPreviewInviteSubject(i: PreviewInviteInput): string {
  return `【${i.siteName ?? "Cloudflare Field Notes"}】「${i.title}」のプレビューのご案内`;
}

export function buildPreviewInviteText(i: PreviewInviteInput): string {
  const lines = [
    `${i.inviterName} より、公開前のコンテンツのプレビューをご案内します。`,
    "",
    `タイトル: ${i.title}`,
    `プレビュー: ${i.url}`,
    `有効期限: ${formatPreviewExpiry(i.expiresAt)}（日本時間）まで`,
  ];
  if (i.message?.trim()) lines.push("", i.message.trim());
  lines.push(
    "",
    "■ 閲覧方法",
    "1. 上のリンクを開きます。",
    `2. Cloudflare Access のログイン画面で、このメールアドレス（${i.email}）を入力し、「Send login code」を選択します。`,
    "3. Cloudflare から届くメールに記載されたコードを入力すると、プレビューが表示されます。",
    "",
    "※ このリンクは上記のメールアドレスでのみ閲覧できます。転送されても、ほかの方は閲覧できません。",
    "※ 公開前の内容のため、取り扱いにご注意ください。"
  );
  return lines.join("\n");
}

function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

export function buildPreviewInviteHtml(i: PreviewInviteInput): string {
  const site = esc(i.siteName ?? "Cloudflare Field Notes");
  const message = i.message?.trim()
    ? `<p style="font-size:14px;line-height:1.7;white-space:pre-wrap;background:#f9fafb;border-left:3px solid #d1d5db;padding:10px 14px;">${esc(i.message.trim())}</p>`
    : "";
  return `<!DOCTYPE html>
<html lang="ja"><head><meta charset="utf-8"></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:600px;margin:0 auto;padding:20px;color:#1a1a1a;">
  <div style="border-bottom:3px solid #f6821f;padding-bottom:16px;margin-bottom:24px;">
    <h1 style="font-size:18px;margin:0;">${site}</h1>
  </div>
  <p style="font-size:15px;line-height:1.7;">${esc(i.inviterName)} より、公開前のコンテンツのプレビューをご案内します。</p>
  <p style="font-size:16px;font-weight:700;margin:20px 0 4px;">${esc(i.title)}</p>
  <p style="font-size:13px;color:#6b7280;margin:0;">有効期限: ${esc(formatPreviewExpiry(i.expiresAt))}（日本時間）まで</p>
  ${message}
  <div style="text-align:center;margin:28px 0;">
    <a href="${esc(i.url)}" style="display:inline-block;background:#1a1a1a;color:#fff;padding:12px 32px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px;">プレビューを開く</a>
  </div>
  <p style="font-size:13px;font-weight:700;margin-bottom:4px;">閲覧方法</p>
  <ol style="font-size:13px;line-height:1.8;color:#374151;padding-left:20px;margin-top:0;">
    <li>上のボタン（またはリンク）を開きます。</li>
    <li>Cloudflare Access のログイン画面で、このメールアドレス（${esc(i.email)}）を入力し、「Send login code」を選択します。</li>
    <li>Cloudflare から届くメールに記載されたコードを入力すると、プレビューが表示されます。</li>
  </ol>
  <p style="font-size:12px;color:#6b7280;line-height:1.6;">
    リンク: <a href="${esc(i.url)}" style="color:#6b7280;">${esc(i.url)}</a><br>
    このリンクは上記のメールアドレスでのみ閲覧できます。転送されても、ほかの方は閲覧できません。<br>
    公開前の内容のため、取り扱いにご注意ください。
  </p>
</body></html>`;
}
