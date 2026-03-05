import { type PlatformProxy } from "wrangler";

interface Env {
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
  CF_API_TOKEN?: string;
  CF_AUTH_EMAIL?: string;
  CF_GLOBAL_API_KEY?: string;
  CF_ACCOUNT_ID?: string;
  CF_ACCESS_APP_ID?: string;
  CF_ACCESS_POLICY_ID?: string;
  CF_ACCESS_TEAM_DOMAIN?: string;
  CF_ACCESS_AUD?: string;
  ADMIN_EMAILS?: string;
  SE_EMAIL_DOMAINS?: string;
  SESSION_SECRET?: string;
  EMAIL_WORKER_URL?: string;
}

type Cloudflare = Omit<PlatformProxy<Env>, "dispose">;

declare module "@remix-run/cloudflare" {
  interface AppLoadContext {
    cloudflare: Cloudflare;
  }
}

type GetLoadContext = (args: {
  request: Request;
  context: { cloudflare: Cloudflare };
}) => AppLoadContext;

import type { AppLoadContext } from "@remix-run/cloudflare";

export const getLoadContext: GetLoadContext = ({ context }) => {
  return context;
};
