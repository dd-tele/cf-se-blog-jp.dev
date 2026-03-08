// Cloudflare bindings type shared across all Hono API routes
export interface Bindings {
  DB: D1Database;
  R2_BUCKET: R2Bucket;
  SESSIONS: KVNamespace;
  PAGE_CACHE: KVNamespace;
  DRAFTS: KVNamespace;
  AI: Ai;
  VECTORIZE: VectorizeIndex;
  ENVIRONMENT: string;
  SITE_NAME: string;
  SITE_URL: string;
  AI_GATEWAY_ID?: string;
  TURNSTILE_SECRET_KEY?: string;
  TURNSTILE_SITE_KEY?: string;
  CF_ACCESS_TEAM_DOMAIN?: string;
  CF_ACCESS_AUD?: string;
  ADMIN_EMAILS?: string;
  SE_EMAIL_DOMAINS?: string;
  SESSION_SECRET?: string;
}

export type HonoEnv = {
  Bindings: Bindings;
  Variables: {
    user?: import("~/lib/auth.server").SessionUser | null;
  };
};
