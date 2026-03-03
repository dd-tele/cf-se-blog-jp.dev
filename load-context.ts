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
