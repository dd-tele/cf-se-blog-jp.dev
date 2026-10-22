import { getAccessJWT, verifyAccessJWT } from "~/lib/access.server";
import { getCfApiAuth } from "~/lib/access-requests.server";
import { PREVIEW_DAY_OPTIONS } from "~/lib/preview-invite";

// ─── Time-limited preview links ────────────────────────────
//
//   SE issues a grant (post × email × expiry) on the edit page
//     → the email is added to the include list of a dedicated Access policy
//   Reviewer opens /preview/:id
//     → Access (application on <site>/preview/*, login method One-time PIN)
//       proves they own the email
//     → the app verifies that JWT against CF_ACCESS_PREVIEW_AUD and checks the
//       grant (same email, not expired, not revoked) and shows only that post.
//
// The preview AUD must NOT be listed in CF_ACCESS_AUD: tokens for that AUD
// would otherwise auto-create a site session/users row (root.tsx), giving the
// reviewer every limited post and /portal. Expiry is enforced here on every
// request; the Access include list is reconciled with the active grants on
// issue/revoke and whenever an expired link is opened.

export const MAX_ACTIVE_GRANTS_PER_POST = 30;
const GRANT_ID_RE = /^[A-Za-z0-9_-]{22}$/;
const EMAIL_RE = /^[^\s@<>()",;:]+@[^\s@<>()",;:]+\.[^\s@<>()",;:]+$/;
// Access rejects a policy with no include rule; this address can never receive a PIN.
const PLACEHOLDER_EMAIL = "nobody@preview.invalid";

export interface PreviewGrantRow {
  id: string;
  post_id: string;
  email: string;
  expires_at: string;
  created_by: string | null;
  created_at: string;
  revoked_at: string | null;
  email_sent_at: string | null;
  last_viewed_at: string | null;
  view_count: number;
}

export type GrantState = "active" | "expired" | "revoked";

/** SQLite-style UTC timestamp, optionally offset from now. */
export function sqlTime(offsetMs = 0): string {
  return new Date(Date.now() + offsetMs).toISOString().replace("T", " ").slice(0, 19);
}

export function grantState(g: Pick<PreviewGrantRow, "expires_at" | "revoked_at">): GrantState {
  if (g.revoked_at) return "revoked";
  return g.expires_at <= sqlTime() ? "expired" : "active";
}

export function normalizePreviewEmail(raw: string): string | null {
  const email = raw.trim().toLowerCase();
  return email.length <= 254 && EMAIL_RE.test(email) ? email : null;
}

export function previewUrl(env: Env, id: string): string {
  return `${(env.SITE_URL || "https://cf-se-blog-jp.dev").replace(/\/$/, "")}/preview/${id}`;
}

export function isPreviewAccessConfigured(env: Env): boolean {
  return Boolean(env.CF_ACCESS_TEAM_DOMAIN && env.CF_ACCESS_PREVIEW_AUD);
}

function newGrantId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function isValidGrantId(id: string | undefined): id is string {
  return !!id && GRANT_ID_RE.test(id);
}

// ─── Queries ──────────────────────────────────────────────

export async function listPreviewGrants(db: D1Database, postId: string): Promise<PreviewGrantRow[]> {
  const { results } = await db
    .prepare("SELECT * FROM preview_grants WHERE post_id = ? ORDER BY created_at DESC LIMIT 100")
    .bind(postId)
    .all<PreviewGrantRow>();
  return results ?? [];
}

export async function getPreviewGrant(db: D1Database, id: string): Promise<PreviewGrantRow | null> {
  return (await db.prepare("SELECT * FROM preview_grants WHERE id = ?").bind(id).first<PreviewGrantRow>()) ?? null;
}

export async function recordPreviewView(db: D1Database, id: string): Promise<void> {
  await db
    .prepare("UPDATE preview_grants SET view_count = view_count + 1, last_viewed_at = ? WHERE id = ?")
    .bind(sqlTime(), id)
    .run();
}

export async function createPreviewGrant(
  db: D1Database,
  opts: { postId: string; email: string; days: number; userId: string }
): Promise<PreviewGrantRow> {
  if (!(PREVIEW_DAY_OPTIONS as readonly number[]).includes(opts.days)) throw new Error("有効期限の指定が不正です。");
  const active = await db
    .prepare("SELECT COUNT(*) AS n FROM preview_grants WHERE post_id = ? AND revoked_at IS NULL AND expires_at > ?")
    .bind(opts.postId, sqlTime())
    .first<{ n: number }>();
  if ((active?.n ?? 0) >= MAX_ACTIVE_GRANTS_PER_POST) {
    throw new Error(`有効なプレビューリンクは 1 記事あたり ${MAX_ACTIVE_GRANTS_PER_POST} 件までです。不要なリンクを取り消してください。`);
  }
  const row: PreviewGrantRow = {
    id: newGrantId(),
    post_id: opts.postId,
    email: opts.email,
    expires_at: sqlTime(opts.days * 24 * 60 * 60 * 1000),
    created_by: opts.userId,
    created_at: sqlTime(),
    revoked_at: null,
    email_sent_at: null,
    last_viewed_at: null,
    view_count: 0,
  };
  await db
    .prepare(
      "INSERT INTO preview_grants (id, post_id, email, expires_at, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?)"
    )
    .bind(row.id, row.post_id, row.email, row.expires_at, row.created_by, row.created_at)
    .run();
  return row;
}

export async function revokePreviewGrant(db: D1Database, postId: string, id: string): Promise<boolean> {
  const res = await db
    .prepare("UPDATE preview_grants SET revoked_at = ? WHERE id = ? AND post_id = ? AND revoked_at IS NULL")
    .bind(sqlTime(), id, postId)
    .run();
  return (res.meta?.changes ?? 0) > 0;
}

export async function markPreviewEmailSent(db: D1Database, id: string): Promise<void> {
  await db.prepare("UPDATE preview_grants SET email_sent_at = ? WHERE id = ?").bind(sqlTime(), id).run();
}

// ─── Access policy reconciliation ─────────────────────────

/**
 * Make the include list of the preview Access policy equal to the set of
 * emails with at least one active grant. Idempotent, so concurrent or missed
 * updates are corrected by the next call. Non-email include rules are kept.
 */
export async function syncPreviewAccessPolicy(
  env: Env
): Promise<{ success: boolean; skipped?: boolean; error?: string }> {
  const auth = getCfApiAuth(env);
  if (!env.CF_ACCOUNT_ID || !env.CF_ACCESS_PREVIEW_POLICY_ID || !auth) {
    return { success: false, skipped: true, error: "プレビュー用 Access ポリシーの環境変数が設定されていません。" };
  }
  const url = `https://api.cloudflare.com/client/v4/accounts/${env.CF_ACCOUNT_ID}/access/policies/${env.CF_ACCESS_PREVIEW_POLICY_ID}`;
  try {
    const { results } = await env.DB
      .prepare("SELECT DISTINCT email FROM preview_grants WHERE revoked_at IS NULL AND expires_at > ? ORDER BY email")
      .bind(sqlTime())
      .all<{ email: string }>();
    const wanted = (results ?? []).map((r) => r.email);

    const getRes = await fetch(url, { headers: auth.headers });
    if (!getRes.ok) return { success: false, error: `Access API GET ${getRes.status}: ${await getRes.text()}` };
    const policy = ((await getRes.json()) as any).result;
    const include: any[] = policy.include ?? [];
    const others = include.filter((r) => !r.email);
    const current = include
      .map((r) => r.email?.email as string | undefined)
      .filter((e): e is string => !!e && e !== PLACEHOLDER_EMAIL)
      .sort();
    if (current.length === wanted.length && current.every((e, i) => e === wanted[i])) return { success: true };

    const next = [...others, ...wanted.map((email) => ({ email: { email } }))];
    if (next.length === 0) next.push({ email: { email: PLACEHOLDER_EMAIL } });
    const putRes = await fetch(url, {
      method: "PUT",
      headers: auth.headers,
      body: JSON.stringify({ ...policy, include: next }),
    });
    if (!putRes.ok) return { success: false, error: `Access API PUT ${putRes.status}: ${await putRes.text()}` };
    return { success: true };
  } catch (e: any) {
    return { success: false, error: `Access API error: ${e?.message ?? e}` };
  }
}

// ─── Viewer verification ──────────────────────────────────

function candidateTokens(request: Request): string[] {
  const out: string[] = [];
  const header = request.headers.get("CF-Access-JWT-Assertion");
  if (header) out.push(header);
  for (const m of (request.headers.get("Cookie") || "").matchAll(/CF_Authorization=([^;]+)/g)) out.push(m[1]);
  const single = getAccessJWT(request);
  if (single && !out.includes(single)) out.push(single);
  return out;
}

export type PreviewViewer =
  | { ok: true; email: string; dev?: boolean }
  | { ok: false; reason: "not_configured" | "no_token" | "invalid" };

/**
 * Identify the reviewer from an Access JWT issued for the preview application.
 * On localhost without Access configuration, `devEmail` is accepted so the
 * flow can be exercised locally (mirrors the mock login rule).
 */
export async function verifyPreviewViewer(request: Request, env: Env, devEmail: string): Promise<PreviewViewer> {
  if (!isPreviewAccessConfigured(env)) {
    const host = new URL(request.url).hostname;
    if (host === "localhost" || host === "127.0.0.1") return { ok: true, email: devEmail, dev: true };
    return { ok: false, reason: "not_configured" };
  }
  const tokens = candidateTokens(request);
  if (tokens.length === 0) return { ok: false, reason: "no_token" };
  for (const t of tokens) {
    const r = await verifyAccessJWT(t, env.CF_ACCESS_TEAM_DOMAIN!, env.CF_ACCESS_PREVIEW_AUD!);
    if (r.ok && r.payload.email) return { ok: true, email: r.payload.email.toLowerCase() };
  }
  return { ok: false, reason: "invalid" };
}

/** "da***@example.com" — enough for the reviewer to recognise, not to harvest. */
export function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!domain) return "***";
  return `${local.slice(0, Math.min(2, local.length))}***@${domain}`;
}
