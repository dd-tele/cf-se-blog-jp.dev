// Abuse controls for the public contributor application form (/apply).
//
// Layers (cheapest first): host check → honeypot → signed form timestamp →
// Turnstile → field validation → disposable-domain list → MX lookup →
// duplicate / volume checks → double opt-in by email.

import { getServerSigningSecret } from "~/lib/auth.server";
import { APPLY_LIMITS, JOB_ROLES } from "~/lib/apply-form";
import type { AccessRequestInput } from "~/lib/access-requests.server";

// ─── Host ──────────────────────────────────────────────────

export function isLocalRequest(request: Request): boolean {
  const host = new URL(request.url).hostname;
  return host === "localhost" || host === "127.0.0.1" || host === "[::1]";
}

/** Production hostname taken from SITE_URL (e.g. "cf-se-blog-jp.dev"). */
export function siteHostname(env: Env): string {
  try {
    return new URL(env.SITE_URL || "https://cf-se-blog-jp.dev").hostname;
  } catch {
    return "cf-se-blog-jp.dev";
  }
}

/**
 * Only accept submissions on the production hostname (where WAF rate limiting
 * and bot rules apply) or on localhost for development. Blocks the
 * *.pages.dev hostname, which bypasses zone-level security rules.
 */
export function isAllowedApplyHost(request: Request, env: Env): boolean {
  if (isLocalRequest(request)) return true;
  return new URL(request.url).hostname === siteHostname(env);
}

// ─── Signed form timestamp (minimum fill time / max age) ───

const FORM_TOKEN_MIN_MS = 3_000; // faster than this is not a human
const FORM_TOKEN_MAX_MS = 2 * 60 * 60 * 1000; // page left open for > 2h → reload

async function hmacHex(secret: string, data: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(data));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function issueApplyFormToken(now = Date.now()): Promise<string> {
  const ts = String(now);
  return `${ts}.${await hmacHex(getServerSigningSecret(), `apply-form:${ts}`)}`;
}

export type FormTokenCheck = "ok" | "invalid" | "too_fast" | "expired";

export async function checkApplyFormToken(token: string | null, now = Date.now()): Promise<FormTokenCheck> {
  if (!token) return "invalid";
  const [ts, sig] = token.split(".");
  if (!ts || !sig || !/^\d{10,16}$/.test(ts)) return "invalid";
  const expected = await hmacHex(getServerSigningSecret(), `apply-form:${ts}`);
  if (!safeEqual(sig, expected)) return "invalid";
  const age = now - Number(ts);
  if (age < FORM_TOKEN_MIN_MS) return "too_fast";
  if (age > FORM_TOKEN_MAX_MS) return "expired";
  return "ok";
}

// ─── Field validation ──────────────────────────────────────

const EMAIL_RE = /^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)+$/;
// eslint-disable-next-line no-control-regex
const CONTROL_RE = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/;
const URL_RE = /(https?:\/\/|www\.)/i;

export type ParsedApply =
  | { ok: true; input: AccessRequestInput; emailConfirm: string }
  | { ok: false; error: string };

function field(formData: FormData, name: string): string {
  const v = formData.get(name);
  return typeof v === "string" ? v.trim() : "";
}

export function parseApplyForm(formData: FormData): ParsedApply {
  const values = {
    display_name: field(formData, "display_name"),
    furigana: field(formData, "furigana"),
    nickname: field(formData, "nickname"),
    email: field(formData, "email").toLowerCase(),
    company: field(formData, "company"),
    job_role: field(formData, "job_role"),
    expertise: field(formData, "expertise"),
    profile_comment: field(formData, "profile_comment"),
  };
  const emailConfirm = field(formData, "email_confirm").toLowerCase();

  if (!values.display_name || !values.email) {
    return { ok: false, error: "名前とメールアドレスは必須です" };
  }
  for (const [name, max] of Object.entries(APPLY_LIMITS) as [keyof typeof APPLY_LIMITS, number][]) {
    if (values[name].length > max) {
      return { ok: false, error: `入力が長すぎる項目があります（${max} 文字まで）` };
    }
  }
  for (const v of Object.values(values)) {
    if (CONTROL_RE.test(v.replace(/[\r\n\t]/g, ""))) {
      return { ok: false, error: "使用できない文字が含まれています" };
    }
  }
  // Names and company never legitimately contain links; spam bots love them.
  if ([values.display_name, values.furigana, values.nickname, values.company].some((v) => URL_RE.test(v))) {
    return { ok: false, error: "名前・所属会社に URL は入力できません" };
  }
  if (!EMAIL_RE.test(values.email)) {
    return { ok: false, error: "正しいメールアドレスを入力してください" };
  }
  if (values.job_role && !(JOB_ROLES as readonly string[]).includes(values.job_role)) {
    return { ok: false, error: "職種の選択が正しくありません" };
  }

  return {
    ok: true,
    emailConfirm,
    input: {
      email: values.email,
      displayName: values.display_name,
      furigana: values.furigana || undefined,
      nickname: values.nickname || undefined,
      company: values.company || undefined,
      jobRole: values.job_role || undefined,
      expertise: values.expertise || undefined,
      profileComment: values.profile_comment || undefined,
    },
  };
}

// ─── Email domain checks ───────────────────────────────────

// Common disposable / throwaway mailbox providers.
const DISPOSABLE_DOMAINS = new Set([
  "mailinator.com", "guerrillamail.com", "guerrillamail.net", "guerrillamail.org", "sharklasers.com",
  "grr.la", "guerrillamailblock.com", "10minutemail.com", "10minutemail.net", "temp-mail.org",
  "tempmail.com", "tempmail.net", "tempmailo.com", "temp-mail.io", "tempr.email", "throwawaymail.com",
  "yopmail.com", "yopmail.net", "yopmail.fr", "trashmail.com", "trashmail.de", "getnada.com",
  "nada.email", "dispostable.com", "maildrop.cc", "mailnesia.com", "mintemail.com", "mohmal.com",
  "emailondeck.com", "fakeinbox.com", "spamgourmet.com", "mailcatch.com", "moakt.com", "tmail.ws",
  "tmpmail.org", "tmpmail.net", "burnermail.io", "discard.email", "mailpoof.com", "inboxkitten.com",
  "1secmail.com", "1secmail.net", "1secmail.org", "emailfake.com", "fakemail.net", "mytemp.email",
  "spambox.us", "trbvm.com", "dropmail.me", "10mail.org", "linshiyouxiang.net", "harakirimail.com",
  "33mail.com", "anonaddy.me", "mail.tm", "mailsac.com", "tempinbox.com", "byom.de", "kasmail.com",
  "minutemail.com", "spam4.me", "mvrht.net", "eyepaste.com", "mailforspam.com", "dodgit.com",
]);

export function emailDomain(email: string): string {
  return email.slice(email.lastIndexOf("@") + 1).toLowerCase();
}

export function isDisposableDomain(domain: string): boolean {
  if (DISPOSABLE_DOMAINS.has(domain)) return true;
  // Sub-domains of listed providers (e.g. "x.mailinator.com").
  for (const d of DISPOSABLE_DOMAINS) if (domain.endsWith(`.${d}`)) return true;
  return false;
}

interface DohAnswer { type: number; data: string }
interface DohResponse { Status: number; Answer?: DohAnswer[] }

async function dohQuery(name: string, type: "MX" | "A" | "AAAA"): Promise<DohResponse | null> {
  try {
    const url = `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(name)}&type=${type}`;
    const res = await fetch(url, {
      headers: { Accept: "application/dns-json" },
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) return null;
    return (await res.json()) as DohResponse;
  } catch {
    return null;
  }
}

/**
 * Whether the domain can receive mail: has MX records (and not a null MX,
 * RFC 7505), or — per RFC 5321 implicit MX — an A/AAAA record.
 * Returns "unknown" if DNS could not be queried (caller should not block).
 */
export async function checkMailDomain(domain: string): Promise<"ok" | "no_mail" | "unknown"> {
  const mx = await dohQuery(domain, "MX");
  if (!mx) return "unknown";
  if (mx.Status === 3) return "no_mail"; // NXDOMAIN
  if (mx.Status !== 0) return "unknown"; // SERVFAIL etc.
  const records = (mx.Answer ?? []).filter((a) => a.type === 15);
  if (records.length > 0) {
    const isNullMx = records.every((r) => /^\d+\s+\.?$/.test(r.data.trim()));
    return isNullMx ? "no_mail" : "ok";
  }
  const [a, aaaa] = await Promise.all([dohQuery(domain, "A"), dohQuery(domain, "AAAA")]);
  if (!a && !aaaa) return "unknown";
  const hasAddr = [a, aaaa].some((r) => (r?.Answer ?? []).some((x) => x.type === 1 || x.type === 28));
  return hasAddr ? "ok" : "no_mail";
}

// ─── Verification tokens ───────────────────────────────────

export function newVerificationToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function isWellFormedVerificationToken(token: string | null): token is string {
  return !!token && /^[A-Za-z0-9_-]{43}$/.test(token);
}

export async function hashVerificationToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`apply-verify:${token}`));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function sqlUtc(date: Date): string {
  return date.toISOString().replace("T", " ").slice(0, 19);
}

export function maskEmail(email: string): string {
  const at = email.lastIndexOf("@");
  if (at < 1) return email;
  const local = email.slice(0, at);
  return `${local.slice(0, Math.min(2, local.length))}${"*".repeat(Math.max(1, local.length - 2))}${email.slice(at)}`;
}
