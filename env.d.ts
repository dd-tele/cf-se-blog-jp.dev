/// <reference types="@remix-run/cloudflare" />
/// <reference types="vite/client" />
/// <reference types="@cloudflare/workers-types" />

interface Env {
  DB: D1Database;
  R2_BUCKET: R2Bucket;
  SESSIONS: KVNamespace;
  PAGE_CACHE: KVNamespace;
  DRAFTS: KVNamespace;
  AI: Ai;
  PRESENT_ROOM: DurableObjectNamespace;
  CASE_DRAFT_QUEUE: Queue<{ requestId: string }>;
  ENVIRONMENT: string;
  SITE_NAME: string;
  SITE_URL: string;
  CF_API_TOKEN?: string;
  CF_AUTH_EMAIL?: string;
  CF_GLOBAL_API_KEY?: string;
  CF_ACCOUNT_ID?: string;
  CF_ACCESS_APP_ID?: string;
  CF_ACCESS_POLICY_ID?: string;
  CF_ACCESS_TEAM_DOMAIN?: string;
  CF_ACCESS_AUD?: string;
  /** AUD of the Access application on <site>/preview/* (One-time PIN). Never add it to CF_ACCESS_AUD. */
  CF_ACCESS_PREVIEW_AUD?: string;
  /** Reusable Access policy whose include list the app syncs with active preview grants. */
  CF_ACCESS_PREVIEW_POLICY_ID?: string;
  ADMIN_EMAILS?: string;
  SE_EMAIL_DOMAINS?: string;
  EMAIL_WORKER_URL?: string;
  /** Shared secret sent as "Authorization: Bearer" to the email Worker. */
  EMAIL_WORKER_SECRET?: string;
  SESSION_SECRET?: string;
}
