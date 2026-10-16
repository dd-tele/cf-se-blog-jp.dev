// Live presentation rooms (presenter display <-> phone remote).
//
// A room is a Durable Object instance (workers/slide-sync) addressed by a
// random room id. The Pages app generates a 256-bit key, sends only its
// SHA-256 hash to the room, and hands the plaintext key to the presenter,
// who shares it with their own phone via QR code. The key is required for
// every WebSocket and for reading speaker notes.

import type { SessionUser } from "~/lib/auth.server";

export const ROOM_TTL_MS = 12 * 60 * 60 * 1000; // 12h — longer than any talk day

const ROOM_ID_RE = /^[A-Za-z0-9_-]{16,64}$/;

function randomToken(bytes: number): string {
  const buf = crypto.getRandomValues(new Uint8Array(bytes));
  let s = "";
  for (const b of buf) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function sha256Hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function roomStub(ns: DurableObjectNamespace, roomId: string) {
  return ns.get(ns.idFromName(roomId));
}

/**
 * Who may present (drive the main screen) and read notes for a deck.
 * Presentation mode is opt-in per deck (slides.presenter_enabled).
 */
export function canPresentSlide(
  user: SessionUser | null,
  slide: { authorId: string; presenterEnabled: boolean }
): boolean {
  if (!user || !slide.presenterEnabled) return false;
  return user.role === "admin" || user.role === "se" || slide.authorId === user.id;
}

export async function createRoom(
  ns: DurableObjectNamespace,
  slide: { id: string; slug: string }
): Promise<{ roomId: string; key: string; expiresAt: number }> {
  const roomId = randomToken(18); // 24 chars
  const key = randomToken(32); // 256-bit
  const expiresAt = Date.now() + ROOM_TTL_MS;
  const res = await roomStub(ns, roomId).fetch("https://room/init", {
    method: "POST",
    body: JSON.stringify({
      slideId: slide.id,
      slug: slide.slug,
      keyHash: await sha256Hex(key),
      expiresAt,
    }),
  });
  if (!res.ok) throw new Error("プレゼンルームの作成に失敗しました。");
  return { roomId, key, expiresAt };
}

export async function verifyRoom(
  ns: DurableObjectNamespace,
  roomId: string | null,
  key: string | null
): Promise<{ slideId: string; slug: string; expiresAt: number } | null> {
  if (!roomId || !key || !ROOM_ID_RE.test(roomId) || key.length > 128) return null;
  try {
    const res = await roomStub(ns, roomId).fetch("https://room/verify", {
      method: "POST",
      body: JSON.stringify({ key }),
    });
    const data = (await res.json()) as {
      ok: boolean;
      slideId?: string;
      slug?: string;
      expiresAt?: number;
    };
    return data.ok && data.slideId && data.slug
      ? { slideId: data.slideId, slug: data.slug, expiresAt: data.expiresAt ?? 0 }
      : null;
  } catch {
    return null;
  }
}

// ─── Deck access pass for paired remotes ───────────────────
// Limited/draft decks normally require a login session. A phone paired via
// QR has no session, so the remote page issues a short-lived HMAC-signed
// cookie scoped to /slides/<slug>/ that the deck server accepts.

const GRANT_COOKIE = "__present_grant";

const DEV_SECRET = "__dev_session_secret_change_in_prod__";

type GrantEnv = { SESSION_SECRET?: string; CF_ACCESS_TEAM_DOMAIN?: string; CF_ACCESS_AUD?: string };

/**
 * Same rule as the session cookie (auth.server.ts): outside local dev the
 * key must be a real secret — the dev default is public. Returns null when
 * deployed without one, which disables grants (fail closed).
 */
function grantSecret(env: GrantEnv): string | null {
  const s = env.SESSION_SECRET || (typeof process !== "undefined" ? process.env?.SESSION_SECRET : undefined);
  if (s && s !== DEV_SECRET && s.length >= 32) return `present-grant:${s}`;
  if (env.CF_ACCESS_TEAM_DOMAIN && env.CF_ACCESS_AUD) return null;
  return `present-grant:${DEV_SECRET}`;
}

async function hmac(secret: string, data: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(data));
  let s = "";
  for (const b of new Uint8Array(sig)) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export async function issueDeckGrantCookie(
  env: GrantEnv,
  slug: string,
  expiresAt: number
): Promise<string | null> {
  const secret = grantSecret(env);
  if (!secret) {
    console.error("[present] SESSION_SECRET is not configured; deck grants are disabled.");
    return null;
  }
  const exp = Math.min(expiresAt, Date.now() + ROOM_TTL_MS);
  const value = `${exp}.${await hmac(secret, `${slug}.${exp}`)}`;
  const maxAge = Math.max(60, Math.floor((exp - Date.now()) / 1000));
  return `${GRANT_COOKIE}=${value}; Path=/slides/${encodeURIComponent(slug)}/; Max-Age=${maxAge}; HttpOnly; Secure; SameSite=Lax`;
}

export async function hasDeckGrant(
  request: Request,
  env: GrantEnv,
  slug: string
): Promise<boolean> {
  const secret = grantSecret(env);
  if (!secret) return false;
  const cookie = request.headers.get("Cookie") || "";
  const m = cookie.match(new RegExp(`(?:^|;\\s*)${GRANT_COOKIE}=([^;]+)`));
  if (!m) return false;
  const [expStr, sig] = m[1].split(".");
  const exp = Number(expStr);
  if (!exp || !sig || Date.now() > exp) return false;
  const expected = await hmac(secret, `${slug}.${exp}`);
  if (expected.length !== sig.length) return false;
  let diff = 0;
  for (let i = 0; i < sig.length; i++) diff |= sig.charCodeAt(i) ^ expected.charCodeAt(i);
  return diff === 0;
}
