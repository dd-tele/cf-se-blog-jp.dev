import { createMiddleware } from "hono/factory";
import type { HonoEnv } from "./types";
import { getSessionUser, type SessionUser } from "~/lib/auth.server";
import { validateApiKey } from "~/lib/api-keys.server";

// Resolve user from Bearer token or session cookie
async function resolveUser(
  req: Request,
  db: D1Database
): Promise<SessionUser | null> {
  // 1. Check Authorization: Bearer <key>
  const authHeader = req.headers.get("Authorization");
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.slice(7).trim();
    if (token.startsWith("cfbk_")) {
      return validateApiKey(db, token);
    }
  }
  // 2. Fall back to session cookie
  return getSessionUser(req);
}

// Populate c.var.user from Bearer token or session cookie (does not block unauthenticated requests)
export const optionalAuth = createMiddleware<HonoEnv>(async (c, next) => {
  const user = await resolveUser(c.req.raw, c.env.DB);
  c.set("user", user);
  await next();
});

// Require authenticated user — returns 401 JSON for API consumers
export const requireAuth = createMiddleware<HonoEnv>(async (c, next) => {
  const user = await resolveUser(c.req.raw, c.env.DB);
  if (!user) {
    return c.json({ error: "認証が必要です。Bearer トークンまたはセッション Cookie を指定してください。" }, 401);
  }
  c.set("user", user);
  await next();
});

// Require specific role(s)
export function requireRole(...roles: Array<SessionUser["role"]>) {
  return createMiddleware<HonoEnv>(async (c, next) => {
    const user = await resolveUser(c.req.raw, c.env.DB);
    if (!user) {
      return c.json({ error: "認証が必要です。Bearer トークンまたはセッション Cookie を指定してください。" }, 401);
    }
    if (!roles.includes(user.role)) {
      return c.json({ error: "権限がありません" }, 403);
    }
    c.set("user", user);
    await next();
  });
}
