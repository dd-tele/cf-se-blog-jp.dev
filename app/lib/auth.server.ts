import { createCookieSessionStorage, redirect } from "@remix-run/cloudflare";
import {
  getAccessJWT,
  verifyAccessJWT,
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

  // If Access is configured, verify the Access JWT is still valid.
  // This prevents the app session (7d) from outliving the Access session.
  if (env && isAccessConfigured(env)) {
    try {
      const jwt = getAccessJWT(request);
      const jwtValid = jwt
        ? (await verifyAccessJWT(jwt, env.CF_ACCESS_TEAM_DOMAIN!, env.CF_ACCESS_AUD!)).ok
        : false;

      if (!jwtValid) {
        // Throw 401 instead of redirect so the root ErrorBoundary can
        // perform a full-page navigation (window.location.href).
        // A normal redirect would break Remix client-side navigation
        // when Cloudflare Access intercepts the target URL.
        const session = await getSession(request);
        const url = new URL(request.url);
        const loginUrl = `${redirectTo}?returnTo=${encodeURIComponent(url.pathname)}`;
        throw new Response(loginUrl, {
          status: 401,
          statusText: "Access Session Expired",
          headers: { "Set-Cookie": await sessionStorage.destroySession(session) },
        });
      }
    } catch (err) {
      if (err instanceof Response) throw err; // re-throw our 401
      console.error("[requireUser] Access JWT check failed:", err);
      // On unexpected errors (e.g. certs fetch failure), still throw 401
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
