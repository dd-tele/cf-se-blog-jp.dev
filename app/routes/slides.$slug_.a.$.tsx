import type { LoaderFunctionArgs } from "@remix-run/cloudflare";
import {
  getSlideHtmlBySlug,
  incrementSlideView,
} from "~/lib/slides.server";
import { contentTypeFor } from "~/lib/slides-bundle.server";
import { getSessionUser } from "~/lib/auth.server";

// Serves a slide deck as a "directory":
//   /slides/:slug/a/            -> the entry HTML (stored in D1)
//   /slides/:slug/a/<path>      -> a bundled asset stored in R2
// This lets arbitrary HTML decks reference their own relative assets
// (css/js/img/fonts) without rewriting, regardless of framework.
export async function loader({ params, context, request }: LoaderFunctionArgs) {
  const slug = params.slug!;
  const assetPath = params["*"] ?? "";
  const env = context.cloudflare.env;

  const row = await getSlideHtmlBySlug(env.DB, slug);
  if (!row) return new Response("Not found", { status: 404 });

  // Drafts and limited slides require an authenticated session (entry + assets).
  if (row.status !== "published" || row.visibility === "limited") {
    const user = await getSessionUser(request);
    if (!user) {
      return new Response("このスライドを表示するにはログインが必要です。", {
        status: 403,
        headers: { "Content-Type": "text/plain; charset=utf-8" },
      });
    }
  }

  // ─── Entry HTML ───────────────────────────────────────────
  if (assetPath === "") {
    const url = new URL(request.url);
    // Ensure a trailing slash so the deck's relative asset paths resolve
    // against this directory.
    if (!url.pathname.endsWith("/")) {
      return new Response(null, {
        status: 308,
        headers: { Location: `${url.pathname}/${url.search}` },
      });
    }

    if (row.status === "published") {
      await incrementSlideView(env.DB, row.id);
    }

    return new Response(row.html, {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "public, max-age=300",
        "Content-Security-Policy": "frame-ancestors 'self'",
      },
    });
  }

  // ─── Bundled asset ────────────────────────────────────────
  if (!row.assetPrefix || assetPath.includes("..")) {
    return new Response("Not found", { status: 404 });
  }

  const object = await env.R2_BUCKET.get(`${row.assetPrefix}/${assetPath}`);
  if (!object) return new Response("Not found", { status: 404 });

  return new Response(object.body as ReadableStream, {
    headers: {
      "Content-Type":
        object.httpMetadata?.contentType || contentTypeFor(assetPath),
      "Cache-Control": "public, max-age=3600",
    },
  });
}
