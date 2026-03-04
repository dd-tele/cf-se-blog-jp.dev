import { createMiddleware } from "hono/factory";
import type { HonoEnv } from "./types";
import { getSessionUser, type SessionUser } from "~/lib/auth.server";

// Populate c.var.user from session cookie (does not block unauthenticated requests)
export const optionalAuth = createMiddleware<HonoEnv>(async (c, next) => {
  const user = await getSessionUser(c.req.raw);
  c.set("user", user);
  await next();
});

// Require authenticated user — returns 401 JSON for API consumers
export const requireAuth = createMiddleware<HonoEnv>(async (c, next) => {
  const user = await getSessionUser(c.req.raw);
  if (!user) {
    return c.json({ error: "認証が必要です" }, 401);
  }
  c.set("user", user);
  await next();
});

// Require specific role(s)
export function requireRole(...roles: Array<SessionUser["role"]>) {
  return createMiddleware<HonoEnv>(async (c, next) => {
    const user = await getSessionUser(c.req.raw);
    if (!user) {
      return c.json({ error: "認証が必要です" }, 401);
    }
    if (!roles.includes(user.role)) {
      return c.json({ error: "権限がありません" }, 403);
    }
    c.set("user", user);
    await next();
  });
}
