import type { LoaderFunctionArgs } from "@remix-run/cloudflare";
import { getSessionUser } from "~/lib/auth.server";
import { getPostBySlug, incrementViewCount } from "~/lib/posts.server";
import { contentTypeFor } from "~/lib/slides-bundle.server";
import { GUIDE_ENTRY_CSP } from "~/lib/case-guides.server";
import { verifyGuideToken } from "~/lib/guide-token.server";

// Serves a 事例 (設計ガイド / 導入アーキテクチャ) as a "directory":
//   /cases/:slug/a/[t.<exp>.<sig>/]          -> entry HTML (posts.content)
//   /cases/:slug/a/[t.<exp>.<sig>/]<path>    -> bundled asset in R2
// Relative references such as ./assets/01-overview.png resolve without rewriting.
//
// The entry HTML is uploaded content, so it is served with a CSP sandbox
// (opaque origin): its scripts cannot read the parent page, the session or
// same-origin APIs. Because a sandboxed document's subresource requests carry
// no cookies, restricted guides authorise via the token path segment, which
// /cases/:slug issues only to viewers who passed the access check.
export async function loader({ params, context, request }: LoaderFunctionArgs) {
  const env = context.cloudflare.env;
  let rest = params["*"] ?? "";

  const post = await getPostBySlug(env.DB, params.slug!);
  if (!post || post.contentType !== "case_guide") {
    return new Response("Not found", { status: 404 });
  }

  let token: string | null = null;
  const m = rest.match(/^(t\.[^/]+)(?:\/(.*))?$/);
  if (m) {
    token = m[1];
    rest = m[2] ?? "";
  }

  // Same rules as articles: unpublished -> author/admin only, limited -> logged-in users.
  const published = post.status === "published";
  const restricted = !published || post.visibility === "limited";
  if (restricted) {
    let allowed = !!token && (await verifyGuideToken(post.id, post.assetPrefix, token));
    if (!allowed) {
      // Direct (non-sandboxed) navigation to the entry still carries the cookie.
      const user = await getSessionUser(request);
      allowed = !!user && (published || user.id === post.authorId || user.role === "admin");
    }
    if (!allowed) {
      return new Response(
        token
          ? "表示用リンクの有効期限が切れました。事例のページを再読み込みしてください。"
          : "この事例を表示するにはログインが必要です。",
        { status: 403, headers: { "Content-Type": "text/plain; charset=utf-8" } }
      );
    }
  }

  // ─── Entry HTML ───────────────────────────────────────────
  if (rest === "") {
    const url = new URL(request.url);
    if (!url.pathname.endsWith("/")) {
      return new Response(null, { status: 308, headers: { Location: `${url.pathname}/${url.search}` } });
    }
    if (published) await incrementViewCount(env.DB, post.id);
    return new Response(post.content, {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": restricted ? "private, no-store" : "public, max-age=300",
        "Content-Security-Policy": GUIDE_ENTRY_CSP,
        "X-Content-Type-Options": "nosniff",
        "Referrer-Policy": "no-referrer",
      },
    });
  }

  // ─── Bundled asset ────────────────────────────────────────
  if (!post.assetPrefix || rest.includes("..")) {
    return new Response("Not found", { status: 404 });
  }
  const object = await env.R2_BUCKET.get(`${post.assetPrefix}/${rest}`);
  if (!object) return new Response("Not found", { status: 404 });

  const type = object.httpMetadata?.contentType || contentTypeFor(rest);
  const headers: Record<string, string> = {
    "Content-Type": type,
    // Asset prefixes are versioned per upload, so public assets can be cached long.
    "Cache-Control": restricted ? "private, max-age=600" : "public, max-age=86400",
    "X-Content-Type-Options": "nosniff",
  };
  // Bundled HTML/SVG opened directly must not run as same-origin script either.
  if (/html|svg|xml/i.test(type)) headers["Content-Security-Policy"] = GUIDE_ENTRY_CSP;
  return new Response(object.body as ReadableStream, { headers });
}
