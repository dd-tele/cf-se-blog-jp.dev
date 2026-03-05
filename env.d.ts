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
  ENVIRONMENT: string;
  SITE_NAME: string;
  SITE_URL: string;
  CF_API_TOKEN?: string;
  CF_ACCOUNT_ID?: string;
  CF_ACCESS_APP_ID?: string;
  CF_ACCESS_POLICY_ID?: string;
  CF_ACCESS_TEAM_DOMAIN?: string;
  CF_ACCESS_AUD?: string;
  ADMIN_EMAILS?: string;
  SE_EMAIL_DOMAINS?: string;
}
