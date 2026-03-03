// ─── KV-based cache layer for published content ─────────────

const DEFAULT_TTL = 300; // 5 minutes
const STALE_TTL = 3600; // 1 hour (serve stale while revalidating)

interface CacheEntry<T> {
  data: T;
  cachedAt: number;
  ttl: number;
}

export async function getCached<T>(
  kv: KVNamespace,
  key: string,
  fetcher: () => Promise<T>,
  ttl = DEFAULT_TTL
): Promise<T> {
  const cacheKey = `cache:${key}`;

  try {
    const raw = await kv.get(cacheKey);
    if (raw) {
      const entry: CacheEntry<T> = JSON.parse(raw);
      const age = (Date.now() - entry.cachedAt) / 1000;

      // Fresh: return immediately
      if (age < entry.ttl) {
        return entry.data;
      }

      // Stale but within STALE_TTL: return stale + revalidate in background
      if (age < STALE_TTL) {
        // Fire-and-forget revalidation
        revalidate(kv, cacheKey, fetcher, ttl).catch(() => {});
        return entry.data;
      }
    }
  } catch {
    // Cache read failed, fall through to fetcher
  }

  // No cache or expired: fetch fresh data
  const data = await fetcher();
  // Write to cache (fire-and-forget)
  writeCache(kv, cacheKey, data, ttl).catch(() => {});
  return data;
}

async function revalidate<T>(
  kv: KVNamespace,
  cacheKey: string,
  fetcher: () => Promise<T>,
  ttl: number
) {
  const data = await fetcher();
  await writeCache(kv, cacheKey, data, ttl);
}

async function writeCache<T>(
  kv: KVNamespace,
  cacheKey: string,
  data: T,
  ttl: number
) {
  const entry: CacheEntry<T> = {
    data,
    cachedAt: Date.now(),
    ttl,
  };
  await kv.put(cacheKey, JSON.stringify(entry), {
    expirationTtl: STALE_TTL + 60, // KV TTL slightly longer than stale window
  });
}

export async function invalidateCache(
  kv: KVNamespace,
  keyPattern: string
) {
  // KV doesn't support pattern delete, so we delete specific keys
  try {
    await kv.delete(`cache:${keyPattern}`);
  } catch {
    // Ignore delete failures
  }
}

// Common cache key builders
export const CacheKeys = {
  publishedPosts: (page = 0, cat = "") => `posts:list:${page}:${cat}`,
  postBySlug: (slug: string) => `posts:slug:${slug}`,
  categories: () => `categories:all`,
  postSummary: (postId: string) => `posts:summary:${postId}`,
} as const;
