import { createCookieSessionStorage, redirect } from "@remix-run/cloudflare";

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
  redirectTo = "/auth/login"
): Promise<SessionUser> {
  const user = await getSessionUser(request);
  if (!user) {
    const url = new URL(request.url);
    const searchParams = new URLSearchParams([["returnTo", url.pathname]]);
    throw redirect(`${redirectTo}?${searchParams}`);
  }
  return user;
}

export async function requireRole(
  request: Request,
  roles: Array<"admin" | "se" | "ae" | "user">
): Promise<SessionUser> {
  const user = await requireUser(request);
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
