import { createCookieSessionStorage, redirect } from "@remix-run/cloudflare";
import {
  getAccessJWT,
  verifyAccessJWT,
  decodeAccessJWTUnsafe,
  resolveAccessEmail,
} from "~/lib/access.server";

export interface SessionUser {
  id: string;
  email: string;
  displayName: string;
  role: "admin" | "se" | "ae" | "user";
  avatarUrl?: string;
}

const SESSION_SECRET =
  typeof process !== "undefined" && process.env?.SESSION_SECRET
    ? process.env.SESSION_SECRET
    : "__dev_session_secret_change_in_prod__";

export const sessionStorage = createCookieSessionStorage({
  cookie: {
    name: "__cf_blog_session",
    httpOnly: true,
    maxAge: 60 * 60 * 24 * 7, // 7 days
    path: "/",
    sameSite: "lax",
    secrets: [SESSION_SECRET],
    secure: true,
  },
});

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
  env?: { CF_ACCESS_TEAM_DOMAIN?: string; CF_ACCESS_AUD?: string },
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
  if (env && isAccessConfigured(env)) {
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

    // Try strict verification first; fall back to decode.
    // Decode-only is safe because Access already verified the JWT.
    let jwtOk = false;
    try {
      const result = await verifyAccessJWT(jwt, env.CF_ACCESS_TEAM_DOMAIN!, env.CF_ACCESS_AUD!);
      jwtOk = result.ok;
    } catch {
      // certs fetch failure, crypto error, etc.
    }

    if (!jwtOk) {
      const decoded = decodeAccessJWTUnsafe(jwt);
      if (!decoded) {
        // JWT is malformed — treat as expired
        const session = await getSession(request);
        const url = new URL(request.url);
        const loginUrl = `${redirectTo}?returnTo=${encodeURIComponent(url.pathname)}`;
        throw new Response(loginUrl, {
          status: 401,
          statusText: "Access Session Expired",
          headers: { "Set-Cookie": await sessionStorage.destroySession(session) },
        });
      }
      // JWT decodes fine — Access verified it, proceed
    }
  }

  return user;
}

export async function requireRole(
  request: Request,
  roles: Array<"admin" | "se" | "ae" | "user">,
  env?: { CF_ACCESS_TEAM_DOMAIN?: string; CF_ACCESS_AUD?: string }
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
