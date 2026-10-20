import { createCookieSessionStorage, redirect, type SessionStorage } from "@remix-run/cloudflare";
import {
  getAccessJWT,
  verifyAccessJWT,
  resolveAccessEmail,
} from "~/lib/access.server";

export interface SessionUser {
  id: string;
  email: string;
  displayName: string;
  role: "admin" | "se" | "ae" | "user";
  avatarUrl?: string;
}

// Secrets/vars are exposed on process.env via nodejs_compat
// (populate_process_env, default since compatibility_date 2025-04-01).
function readEnv(name: string): string | undefined {
  return typeof process !== "undefined" ? process.env?.[name] || undefined : undefined;
}

const DEV_SESSION_SECRET = "__dev_session_secret_change_in_prod__";

/**
 * The session cookie is the only thing that carries a user's role, so its
 * signing key must never be the well-known dev default outside local dev
 * (the repository is public).
 *
 * In a deployed environment (Access configured) without a proper
 * SESSION_SECRET we fail closed but stay up: cookies are read with a random
 * per-isolate key, so nobody — including forgers using the dev default —
 * has a valid session and public pages render anonymously; issuing a new
 * session (login) throws.
 */
type SecretState = { secret: string; canIssue: boolean };
function resolveSessionSecret(): SecretState {
  const secret = readEnv("SESSION_SECRET");
  if (secret && secret !== DEV_SESSION_SECRET && secret.length >= 32) {
    return { secret, canIssue: true };
  }
  const deployed = !!(readEnv("CF_ACCESS_TEAM_DOMAIN") && readEnv("CF_ACCESS_AUD"));
  if (deployed) {
    console.error("[Auth] SESSION_SECRET is missing or shorter than 32 chars; sessions are disabled.");
    return { secret: `${crypto.randomUUID()}${crypto.randomUUID()}`, canIssue: false };
  }
  return { secret: DEV_SESSION_SECRET, canIssue: true };
}

let signingSecret: string | null = null;
/**
 * Server-side HMAC key for short-lived capability tokens (e.g. design guide
 * asset URLs). Same source and fail-closed behaviour as the session secret;
 * callers must domain-separate their messages.
 */
export function getServerSigningSecret(): string {
  signingSecret ??= resolveSessionSecret().secret;
  return signingSecret;
}

type CookieSessionStorage = SessionStorage;
let storage: { store: CookieSessionStorage; canIssue: boolean } | null = null;
function getStorage() {
  if (!storage) {
    const { secret, canIssue } = resolveSessionSecret();
    storage = {
      canIssue,
      store: createCookieSessionStorage({
        cookie: {
          name: "__cf_blog_session",
          httpOnly: true,
          maxAge: 60 * 60 * 24 * 7, // 7 days
          path: "/",
          sameSite: "lax",
          secrets: [secret],
          secure: true,
        },
      }),
    };
  }
  return storage;
}

// Lazily initialised so the secret is read at request time, not module load.
export const sessionStorage: CookieSessionStorage = {
  getSession: (...args) => getStorage().store.getSession(...args),
  commitSession: (...args) => {
    const s = getStorage();
    if (!s.canIssue) {
      throw new Error("SESSION_SECRET is not configured; refusing to issue a session.");
    }
    return s.store.commitSession(...args);
  },
  destroySession: (...args) => getStorage().store.destroySession(...args),
};

export function isAccessConfigured(env: {
  CF_ACCESS_TEAM_DOMAIN?: string;
  CF_ACCESS_AUD?: string;
}): boolean {
  return !!(env.CF_ACCESS_TEAM_DOMAIN && env.CF_ACCESS_AUD);
}

export async function getSession(request: Request) {
  return sessionStorage.getSession(request.headers.get("Cookie"));
}

export async function getSessionUser(
  request: Request
): Promise<SessionUser | null> {
  const session = await getSession(request);
  const user = session.get("user") as SessionUser | undefined;
  return user ?? null;
}

export async function requireUser(
  request: Request,
  env: { CF_ACCESS_TEAM_DOMAIN?: string; CF_ACCESS_AUD?: string },
  redirectTo = "/auth/login"
): Promise<SessionUser> {
  const user = await getSessionUser(request);
  if (!user) {
    const url = new URL(request.url);
    const searchParams = new URLSearchParams([["returnTo", url.pathname]]);
    throw redirect(`${redirectTo}?${searchParams}`);
  }

  // If Access is configured, check the Access JWT is still present
  // AND that the JWT email matches the session email.
  // If a different user logged in via Access, the session must be
  // recreated for the new user to prevent identity mismatch.
  if (isAccessConfigured(env)) {
    const jwt = getAccessJWT(request);
    if (!jwt) {
      // No JWT at all — Access session truly expired
      const session = await getSession(request);
      const url = new URL(request.url);
      const loginUrl = `${redirectTo}?returnTo=${encodeURIComponent(url.pathname)}`;
      throw new Response(loginUrl, {
        status: 401,
        statusText: "Access Session Expired",
        headers: { "Set-Cookie": await sessionStorage.destroySession(session) },
      });
    }

    // Check for email mismatch (different user logged in via Access)
    const jwtEmail = resolveAccessEmail(jwt);
    if (jwtEmail && jwtEmail !== user.email.toLowerCase()) {
      console.warn(
        `[Auth] Email mismatch: session=${user.email}, jwt=${jwtEmail}. Destroying stale session.`
      );
      const session = await getSession(request);
      const url = new URL(request.url);
      const loginUrl = `${redirectTo}?returnTo=${encodeURIComponent(url.pathname)}`;
      throw redirect(loginUrl, {
        headers: { "Set-Cookie": await sessionStorage.destroySession(session) },
      });
    }

    // The JWT must verify. Never fall back to an unverified decode: not every
    // path is behind Access (e.g. "/", "/auth/login", "/api/*"), so a
    // CF_Authorization cookie can be attacker-supplied.
    let jwtOk = false;
    try {
      const result = await verifyAccessJWT(jwt, env.CF_ACCESS_TEAM_DOMAIN!, env.CF_ACCESS_AUD!);
      jwtOk = result.ok;
      if (!result.ok) console.warn(`[Auth] Access JWT rejected: ${result.reason}`);
    } catch (e) {
      console.error("[Auth] Access JWT verification error:", e);
    }

    if (!jwtOk) {
      const session = await getSession(request);
      const url = new URL(request.url);
      const loginUrl = `${redirectTo}?returnTo=${encodeURIComponent(url.pathname)}`;
      throw new Response(loginUrl, {
        status: 401,
        statusText: "Access Session Expired",
        headers: { "Set-Cookie": await sessionStorage.destroySession(session) },
      });
    }
  }

  return user;
}

export async function requireRole(
  request: Request,
  roles: Array<"admin" | "se" | "ae" | "user">,
  env: { CF_ACCESS_TEAM_DOMAIN?: string; CF_ACCESS_AUD?: string }
): Promise<SessionUser> {
  const user = await requireUser(request, env);
  if (!roles.includes(user.role)) {
    throw new Response("Forbidden", { status: 403 });
  }
  return user;
}

export async function createUserSession(user: SessionUser, redirectTo: string) {
  const session = await sessionStorage.getSession();
  session.set("user", user);
  return redirect(redirectTo, {
    headers: {
      "Set-Cookie": await sessionStorage.commitSession(session),
    },
  });
}

export async function destroyUserSession(request: Request, redirectTo = "/") {
  const session = await getSession(request);
  return redirect(redirectTo, {
    headers: {
      "Set-Cookie": await sessionStorage.destroySession(session),
    },
  });
}
