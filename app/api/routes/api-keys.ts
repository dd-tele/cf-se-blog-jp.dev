import { Hono } from "hono";
import type { HonoEnv } from "../types";
import { requireAuth } from "../middleware";
import { createApiKey, listApiKeys, revokeApiKey } from "~/lib/api-keys.server";

const apiKeysRoute = new Hono<HonoEnv>();

// ─── GET /api/v1/api-keys — List current user's keys ────────
apiKeysRoute.get("/", requireAuth, async (c) => {
  const user = c.var.user!;
  const keys = await listApiKeys(c.env.DB, user.id);
  return c.json({ keys });
});

// ─── POST /api/v1/api-keys — Create a new key ──────────────
apiKeysRoute.post("/", requireAuth, async (c) => {
  const user = c.var.user!;
  const body = await c.req.json<{ name?: string }>().catch(() => ({ name: undefined }));
  const name = body.name?.trim() || "My API Key";

  if (name.length > 100) {
    return c.json({ error: "キー名は100文字以内にしてください" }, 400);
  }

  // Limit to 1 active key per user
  const existing = await listApiKeys(c.env.DB, user.id);
  const activeCount = existing.filter((k) => k.isActive).length;
  if (activeCount >= 1) {
    return c.json({ error: "API キーは1つまでです。既存のキーを削除してから再作成してください。" }, 400);
  }

  const result = await createApiKey(c.env.DB, user.id, name);

  return c.json({
    id: result.id,
    name,
    key: result.rawKey,
    prefix: result.prefix,
    message: "このキーは一度だけ表示されます。安全な場所に保存してください。",
  }, 201);
});

// ─── DELETE /api/v1/api-keys/:id — Revoke a key ────────────
apiKeysRoute.delete("/:id", requireAuth, async (c) => {
  const user = c.var.user!;
  const keyId = c.req.param("id");
  const revoked = await revokeApiKey(c.env.DB, keyId, user.id);

  if (!revoked) {
    return c.json({ error: "キーが見つからないか、既に無効化されています" }, 404);
  }

  return c.json({ success: true, message: "API キーを無効化しました" });
});

export default apiKeysRoute;
