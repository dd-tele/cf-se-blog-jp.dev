import { eq, and, desc } from "drizzle-orm";
import { getDb } from "./db.server";
import { apiKeys, users } from "~/db/schema";
import { ulid } from "./ulid";
import type { SessionUser } from "./auth.server";

// ─── Key generation ─────────────────────────────────────────

/** Generate a random API key: cfbk_<40 hex chars> */
function generateRawKey(): string {
  const bytes = new Uint8Array(20);
  crypto.getRandomValues(bytes);
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  return `cfbk_${hex}`;
}

/** SHA-256 hash of a key */
async function hashKey(key: string): Promise<string> {
  const encoded = new TextEncoder().encode(key);
  const buf = await crypto.subtle.digest("SHA-256", encoded);
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, "0")).join("");
}

// ─── CRUD operations ────────────────────────────────────────

export async function createApiKey(
  db: D1Database,
  userId: string,
  name: string
): Promise<{ id: string; rawKey: string; prefix: string }> {
  const d = getDb(db);
  const rawKey = generateRawKey();
  const keyHash = await hashKey(rawKey);
  const prefix = rawKey.slice(0, 12) + "...";
  const id = ulid();
  const now = new Date().toISOString().replace("T", " ").slice(0, 19);

  await d.insert(apiKeys).values({
    id,
    user_id: userId,
    name,
    key_prefix: prefix,
    key_hash: keyHash,
    is_active: true,
    created_at: now,
    updated_at: now,
  });

  return { id, rawKey, prefix };
}

export async function listApiKeys(db: D1Database, userId: string) {
  const d = getDb(db);
  return d
    .select({
      id: apiKeys.id,
      name: apiKeys.name,
      keyPrefix: apiKeys.key_prefix,
      isActive: apiKeys.is_active,
      lastUsedAt: apiKeys.last_used_at,
      createdAt: apiKeys.created_at,
    })
    .from(apiKeys)
    .where(eq(apiKeys.user_id, userId))
    .orderBy(desc(apiKeys.created_at))
    .all();
}

export async function revokeApiKey(
  db: D1Database,
  keyId: string,
  userId: string
): Promise<boolean> {
  const d = getDb(db);
  const now = new Date().toISOString().replace("T", " ").slice(0, 19);
  const result = await d
    .update(apiKeys)
    .set({ is_active: false, updated_at: now })
    .where(and(eq(apiKeys.id, keyId), eq(apiKeys.user_id, userId)));
  return (result as any).changes > 0;
}

// ─── Validation (for middleware) ────────────────────────────

export async function validateApiKey(
  db: D1Database,
  rawKey: string
): Promise<SessionUser | null> {
  const keyHash = await hashKey(rawKey);
  const d = getDb(db);

  const rows = await d
    .select({
      keyId: apiKeys.id,
      userId: apiKeys.user_id,
      isActive: apiKeys.is_active,
      email: users.email,
      displayName: users.display_name,
      nickname: users.nickname,
      role: users.role,
      avatarUrl: users.avatar_url,
      userIsActive: users.is_active,
    })
    .from(apiKeys)
    .innerJoin(users, eq(apiKeys.user_id, users.id))
    .where(eq(apiKeys.key_hash, keyHash))
    .limit(1)
    .all();

  if (rows.length === 0) return null;

  const row = rows[0];
  if (!row.isActive || !row.userIsActive) return null;

  // Update last_used_at (fire-and-forget)
  const now = new Date().toISOString().replace("T", " ").slice(0, 19);
  d.update(apiKeys)
    .set({ last_used_at: now })
    .where(eq(apiKeys.id, row.keyId))
    .then(() => {})
    .catch(() => {});

  return {
    id: row.userId,
    email: row.email,
    displayName: row.nickname || row.displayName,
    role: row.role as SessionUser["role"],
    avatarUrl: row.avatarUrl ?? undefined,
  };
}
