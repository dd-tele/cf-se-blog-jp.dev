import { getServerSigningSecret } from "~/lib/auth.server";

// Design guide HTML is served with `Content-Security-Policy: sandbox`, which
// gives the document an opaque origin. Its subresource requests therefore do
// not carry the session cookie, so restricted guides authorise asset requests
// with a short-lived capability token embedded in the URL path instead:
//
//   /cases/:slug/a/t.<exp>.<sig>/            -> entry HTML
//   /cases/:slug/a/t.<exp>.<sig>/assets/x.png
//
// Relative references (./assets/...) resolve under the token segment, so the
// uploaded HTML needs no rewriting.

const TOKEN_TTL_SECONDS = 12 * 60 * 60;
export const GUIDE_TOKEN_RE = /^t\.(\d{10})\.([A-Za-z0-9_-]{43})$/;

const encoder = new TextEncoder();
let keyPromise: Promise<CryptoKey> | null = null;
function getKey(): Promise<CryptoKey> {
  keyPromise ??= crypto.subtle.importKey(
    "raw",
    encoder.encode(getServerSigningSecret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
  return keyPromise;
}

function b64url(buf: ArrayBuffer): string {
  let s = "";
  for (const b of new Uint8Array(buf)) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64urlDecode(s: string): Uint8Array<ArrayBuffer> {
  const bin = atob(s.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (s.length % 4)) % 4));
  const out = new Uint8Array(new ArrayBuffer(bin.length));
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

const message = (postId: string, assetPrefix: string, exp: number) =>
  encoder.encode(`case-guide-asset:v1:${postId}:${assetPrefix}:${exp}`);

/**
 * Issue a token bound to the guide and its current asset version, so replacing
 * the ZIP (new prefix) or deleting the guide invalidates outstanding tokens.
 */
export async function issueGuideToken(postId: string, assetPrefix: string | null): Promise<string> {
  const exp = Math.floor(Date.now() / 1000) + TOKEN_TTL_SECONDS;
  const sig = await crypto.subtle.sign("HMAC", await getKey(), message(postId, assetPrefix ?? "", exp));
  return `t.${exp}.${b64url(sig)}`;
}

export async function verifyGuideToken(
  postId: string,
  assetPrefix: string | null,
  token: string
): Promise<boolean> {
  const m = token.match(GUIDE_TOKEN_RE);
  if (!m) return false;
  const exp = Number(m[1]);
  if (!Number.isFinite(exp) || exp < Math.floor(Date.now() / 1000)) return false;
  try {
    return await crypto.subtle.verify(
      "HMAC",
      await getKey(),
      b64urlDecode(m[2]),
      message(postId, assetPrefix ?? "", exp)
    );
  } catch {
    return false;
  }
}
