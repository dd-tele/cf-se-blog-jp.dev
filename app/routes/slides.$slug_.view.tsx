import type { LoaderFunctionArgs } from "@remix-run/cloudflare";
import { getSlideHtmlBySlug, getSlideBySlug, incrementSlideView } from "~/lib/slides.server";
import { getSessionUser } from "~/lib/auth.server";

// Resource route: returns the raw slide HTML document (reveal.js deck).
// Served from the same origin so the deck's relative /slides-assets/*
// references resolve correctly.
export async function loader({ params, context, request }: LoaderFunctionArgs) {
  const slug = params.slug!;
  const db = context.cloudflare.env.DB;

  const row = await getSlideHtmlBySlug(db, slug);
  if (!row) {
    return new Response("Not found", { status: 404 });
  }

  // Drafts and limited slides require an authenticated session.
  if (row.status !== "published" || row.visibility === "limited") {
    const user = await getSessionUser(request);
    if (!user) {
      return new Response("このスライドを表示するにはログインが必要です。", {
        status: 403,
        headers: { "Content-Type": "text/plain; charset=utf-8" },
      });
    }
  }

  // Best-effort view count (only for published).
  if (row.status === "published") {
    const meta = await getSlideBySlug(db, slug);
    if (meta) await incrementSlideView(db, meta.id);
  }

  return new Response(row.html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "public, max-age=300",
      // Allow the deck to be embedded in our own detail page iframe.
      "Content-Security-Policy": "frame-ancestors 'self'",
    },
  });
}
