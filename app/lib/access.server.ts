import type { SessionUser } from "./auth.server";

// ─── Cloudflare Access JWT Verification ───────────────────

interface AccessJWTPayload {
  aud: string[];
  email: string;
  sub: string;
  iss: string;
  iat: number;
  exp: number;
  type: string;
  identity_nonce: string;
  custom?: Record<string, unknown>;
}

interface JWK {
  kid: string;
  kty: string;
  alg: string;
  use: string;
  e: string;
  n: string;
}

interface CertsResponse {
  keys: JWK[];
  public_cert: { kid: string; cert: string }[];
  public_certs: { kid: string; cert: string }[];
}

// Cache public keys in module scope (per isolate)
let cachedKeys: { keys: JWK[]; fetchedAt: number } | null = null;
const KEY_CACHE_TTL = 60 * 60 * 1000; // 1 hour

async function getPublicKeys(teamDomain: string): Promise<JWK[]> {
  if (cachedKeys && Date.now() - cachedKeys.fetchedAt < KEY_CACHE_TTL) {
    return cachedKeys.keys;
  }

  const certsUrl = `https://${teamDomain}.cloudflareaccess.com/cdn-cgi/access/certs`;
  const res = await fetch(certsUrl);
  if (!res.ok) {
    throw new Error(`Failed to fetch Access certs: ${res.status}`);
  }

  const data = (await res.json()) as CertsResponse;
  cachedKeys = { keys: data.keys, fetchedAt: Date.now() };
  return data.keys;
}

function base64UrlDecode(str: string): Uint8Array {
  const base64 = str.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

async function importKey(jwk: JWK): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "jwk",
    { kty: jwk.kty, e: jwk.e, n: jwk.n, alg: "RS256", ext: true },
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["verify"]
  );
}

/**
 * Verify and decode the Cloudflare Access JWT.
 * Returns the payload if valid, null otherwise.
 */
export async function verifyAccessJWT(
  token: string,
  teamDomain: string,
  aud: string
): Promise<AccessJWTPayload | null> {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;

    const [headerB64, payloadB64, signatureB64] = parts;

    // Decode header to get kid
    const header = JSON.parse(new TextDecoder().decode(base64UrlDecode(headerB64)));
    const kid = header.kid as string;
    if (!kid) return null;

    // Fetch public keys and find matching key
    const keys = await getPublicKeys(teamDomain);
    const jwk = keys.find((k) => k.kid === kid);
    if (!jwk) return null;

    // Verify signature
    const key = await importKey(jwk);
    const data = new TextEncoder().encode(`${headerB64}.${payloadB64}`);
    const signature = base64UrlDecode(signatureB64);

    const valid = await crypto.subtle.verify(
      "RSASSA-PKCS1-v1_5",
      key,
      signature.buffer as ArrayBuffer,
      data.buffer as ArrayBuffer
    );
    if (!valid) return null;

    // Decode and validate payload
    const payload = JSON.parse(
      new TextDecoder().decode(base64UrlDecode(payloadB64))
    ) as AccessJWTPayload;

    // Verify audience
    if (!payload.aud || !payload.aud.includes(aud)) return null;

    // Verify expiration
    if (payload.exp && payload.exp < Date.now() / 1000) return null;

    // Verify issuer
    const expectedIssuer = `https://${teamDomain}.cloudflareaccess.com`;
    if (payload.iss !== expectedIssuer) return null;

    return payload;
  } catch (e) {
    console.error("Access JWT verification failed:", e);
    return null;
  }
}

/**
 * Extract Access JWT from request headers.
 * Cloudflare Access sends the JWT in both a header and a cookie.
 */
export function getAccessJWT(request: Request): string | null {
  // Header takes priority
  const headerToken = request.headers.get("CF-Access-JWT-Assertion");
  if (headerToken) return headerToken;

  // Fallback to cookie
  const cookies = request.headers.get("Cookie") || "";
  const match = cookies.match(/CF_Authorization=([^;]+)/);
  return match ? match[1] : null;
}

/**
 * Determine user role based on email and configuration.
 */
export function resolveRole(
  email: string,
  adminEmails?: string,
  seEmailDomains?: string
): "admin" | "se" | "user" {
  const lowerEmail = email.toLowerCase();

  // Check admin list
  if (adminEmails) {
    const admins = adminEmails.split(",").map((e) => e.trim().toLowerCase());
    if (admins.includes(lowerEmail)) return "admin";
  }

  // Check SE email domains
  const seDomains = seEmailDomains
    ? seEmailDomains.split(",").map((d) => d.trim().toLowerCase())
    : ["cloudflare.com"];

  const domain = lowerEmail.split("@")[1];
  if (domain && seDomains.includes(domain)) return "se";

  return "user";
}

/**
 * Build a SessionUser from a verified Access JWT payload.
 */
export function buildSessionUserFromAccess(
  payload: AccessJWTPayload,
  role: "admin" | "se" | "user"
): SessionUser {
  const email = payload.email;
  const name = email.split("@")[0].replace(/[._-]/g, " ");
  const displayName = name
    .split(" ")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");

  return {
    id: `access-${payload.sub}`,
    email,
    displayName,
    role,
  };
}
